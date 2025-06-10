import { useState, useEffect } from 'react'
import { supabase, type VivaQueue, type SystemSettings } from '../../utils/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PlayCircle, SkipForward, AlertTriangle, UserX, Users } from 'lucide-react'

export default function AdminPage() {
  const [enrollmentList, setEnrollmentList] = useState('')
  const [studentsToShow, setStudentsToShow] = useState(5)
  const [currentBatchStart, setCurrentBatchStart] = useState(1)
  const [queueStarted, setQueueStarted] = useState(false)
  const [totalStudents, setTotalStudents] = useState(0)
  const [warningStudentId, setWarningStudentId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSystemSettings()
    loadQueueData()
  }, [])

  const loadSystemSettings = async () => {
    const { data } = await supabase
      .from('viva_system_settings')
      .select('*')

    if (data) {
      data.forEach((setting: SystemSettings) => {
        switch (setting.setting_key) {
          case 'students_to_show':
            setStudentsToShow(parseInt(setting.setting_value))
            break
          case 'current_batch_start':
            setCurrentBatchStart(parseInt(setting.setting_value))
            break
          case 'queue_started':
            setQueueStarted(setting.setting_value === 'true')
            break
          case 'warning_student_id':
            setWarningStudentId(setting.setting_value ? parseInt(setting.setting_value) : null)
            break
        }
      })
    }
  }

  const loadQueueData = async () => {
    const { data, count } = await supabase
      .from('viva_queue')
      .select('*', { count: 'exact' })
      .eq('status', 'waiting')
      .order('queue_position')

    if (count !== null) {
      setTotalStudents(count)
    }
  }

  const updateSystemSetting = async (key: string, value: string) => {
    await supabase
      .from('viva_system_settings')
      .upsert({ setting_key: key, setting_value: value })
  }

  const handleUploadList = async () => {
    if (!enrollmentList.trim()) {
      setMessage('Please enter enrollment numbers')
      return
    }

    setIsLoading(true)
    try {
      // Clear existing queue
      await supabase.from('viva_queue').delete().neq('id', 0)

      // Parse enrollment numbers
      const enrollments = enrollmentList
        .trim()
        .split('\n')
        .map(num => num.trim())
        .filter(num => num !== '')

      // Insert new queue
      const queueData = enrollments.map((enrollment, index) => ({
        enrollment_number: enrollment,
        queue_position: index + 1,
        status: 'waiting' as const
      }))

      const { error } = await supabase
        .from('viva_queue')
        .insert(queueData)

      if (error) throw error

      setMessage(`Successfully uploaded ${enrollments.length} students`)
      setEnrollmentList('')
      loadQueueData()

      // Reset system settings
      await updateSystemSetting('current_batch_start', '1')
      await updateSystemSetting('queue_started', 'false')
      setCurrentBatchStart(1)
      setQueueStarted(false)

    } catch (error) {
      setMessage('Error uploading list: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStudentsToShow = async () => {
    await updateSystemSetting('students_to_show', studentsToShow.toString())
    setMessage('Students to show counter updated')
  }

  const handleStartQueue = async () => {
    if (totalStudents === 0) {
      setMessage('Please upload student list first')
      return
    }

    setIsLoading(true)
    try {
      await updateSystemSetting('queue_started', 'true')
      await updateSystemSetting('current_batch_start', '1')
      
      // Trigger announcement for first batch on monitor page
      const { data } = await supabase
        .from('viva_queue')
        .select('enrollment_number')
        .eq('status', 'waiting')
        .eq('queue_position', 1)
        .single()

      if (data) {
        // This will be picked up by the monitor page
        await supabase
          .from('viva_system_settings')
          .upsert({ setting_key: 'announce_student', setting_value: data.enrollment_number })
      }

      setQueueStarted(true)
      setCurrentBatchStart(1)
      setMessage('Queue started!')
    } catch (error) {
      setMessage('Error starting queue: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNext = async () => {
    if (!queueStarted) {
      setMessage('Please start the queue first')
      return
    }

    setIsLoading(true)
    try {
      // Remove current batch students from queue
      const endPosition = currentBatchStart + studentsToShow - 1
      
      await supabase
        .from('viva_queue')
        .delete()
        .gte('queue_position', currentBatchStart)
        .lte('queue_position', endPosition)
        .eq('status', 'waiting')

      // Update positions of remaining students
      const { data: remainingStudents } = await supabase
        .from('viva_queue')
        .select('*')
        .eq('status', 'waiting')
        .order('queue_position')

      if (remainingStudents && remainingStudents.length > 0) {
        // Renumber the queue
        const updates = remainingStudents.map((student, index) => ({
          id: student.id,
          queue_position: index + 1
        }))

        for (const update of updates) {
          await supabase
            .from('viva_queue')
            .update({ queue_position: update.queue_position })
            .eq('id', update.id)
        }

        // Set new batch start to 1 and announce first student
        await updateSystemSetting('current_batch_start', '1')
        setCurrentBatchStart(1)

        const nextStudent = remainingStudents[0]
        await supabase
          .from('viva_system_settings')
          .upsert({ setting_key: 'announce_student', setting_value: nextStudent.enrollment_number })

        loadQueueData()
        setMessage('Moved to next batch')
      } else {
        setMessage('No more students in queue')
        setQueueStarted(false)
        await updateSystemSetting('queue_started', 'false')
      }
    } catch (error) {
      setMessage('Error moving to next batch: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWarning = async () => {
    if (!queueStarted || currentBatchStart > totalStudents) {
      setMessage('No student to warn')
      return
    }

    try {
      const { data } = await supabase
        .from('viva_queue')
        .select('*')
        .eq('status', 'waiting')
        .eq('queue_position', currentBatchStart)
        .single()

      if (data) {
        setWarningStudentId(data.id)
        await updateSystemSetting('warning_student_id', data.id.toString())
        
        // Announce warning on monitor
        await supabase
          .from('viva_system_settings')
          .upsert({ 
            setting_key: 'announce_warning', 
            setting_value: `Student ${data.enrollment_number} report immediately or you will be moved to the end of viva queue`
          })

        setMessage(`Warning sent to student ${data.enrollment_number}`)
      }
    } catch (error) {
      setMessage('Error sending warning: ' + (error as Error).message)
    }
  }

  const handleMoveToEnd = async () => {
    if (!warningStudentId) return

    setIsLoading(true)
    try {
      // Get the warned student
      const { data: warnedStudent } = await supabase
        .from('viva_queue')
        .select('*')
        .eq('id', warningStudentId)
        .single()

      if (warnedStudent) {
        // Get max position
        const { data: maxPos } = await supabase
          .from('viva_queue')
          .select('queue_position')
          .eq('status', 'waiting')
          .order('queue_position', { ascending: false })
          .limit(1)
          .single()

        const newPosition = maxPos ? maxPos.queue_position + 1 : 1

        // Move student to end
        await supabase
          .from('viva_queue')
          .update({ queue_position: newPosition })
          .eq('id', warningStudentId)

        // Update positions of other students (shift them up)
        const { data: studentsToShift } = await supabase
          .from('viva_queue')
          .select('*')
          .gt('queue_position', warnedStudent.queue_position)
          .eq('status', 'waiting')
          .order('queue_position')

        if (studentsToShift) {
          for (const student of studentsToShift) {
            await supabase
              .from('viva_queue')
              .update({ queue_position: student.queue_position - 1 })
              .eq('id', student.id)
          }
        }

        setWarningStudentId(null)
        await updateSystemSetting('warning_student_id', '')
        loadQueueData()
        setMessage(`Student ${warnedStudent.enrollment_number} moved to end of queue`)
      }
    } catch (error) {
      setMessage('Error moving student: ' + (error as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Viva Queue Admin Panel</h1>
          <p className="text-gray-600">Manage the viva queue system</p>
        </div>

        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {/* Upload Students List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Upload Students List
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste enrollment numbers here (one per line)&#10;Example:&#10;2021001&#10;2021002&#10;2021003"
              value={enrollmentList}
              onChange={(e) => setEnrollmentList(e.target.value)}
              rows={8}
            />
            <Button 
              onClick={handleUploadList} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Uploading...' : 'Upload List'}
            </Button>
          </CardContent>
        </Card>

        {/* Students Counter */}
        <Card>
          <CardHeader>
            <CardTitle>Students to Show Counter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={studentsToShow}
                onChange={(e) => setStudentsToShow(parseInt(e.target.value) || 5)}
                min="1"
                max="20"
                className="w-24"
              />
              <Button onClick={handleUpdateStudentsToShow}>
                Update Counter
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              This determines how many students will be shown on the monitor page at once.
            </p>
          </CardContent>
        </Card>

        {/* Queue Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Queue Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                onClick={handleStartQueue}
                disabled={isLoading || queueStarted}
                className="flex items-center gap-2"
                size="lg"
              >
                <PlayCircle className="h-4 w-4" />
                {queueStarted ? 'Queue Started' : 'Start Queue'}
              </Button>

              <Button
                onClick={handleNext}
                disabled={isLoading || !queueStarted}
                className="flex items-center gap-2"
                size="lg"
              >
                <SkipForward className="h-4 w-4" />
                Next Batch
              </Button>

              <Button
                onClick={handleWarning}
                disabled={isLoading || !queueStarted}
                variant="destructive"
                className="flex items-center gap-2"
                size="lg"
              >
                <AlertTriangle className="h-4 w-4" />
                Send Warning
              </Button>

              {warningStudentId && (
                <Button
                  onClick={handleMoveToEnd}
                  disabled={isLoading}
                  variant="outline"
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <UserX className="h-4 w-4" />
                  Move to End
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status Display */}
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{totalStudents}</p>
                <p className="text-sm text-gray-600">Total Students</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{studentsToShow}</p>
                <p className="text-sm text-gray-600">Showing</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{currentBatchStart}</p>
                <p className="text-sm text-gray-600">Current Batch</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${queueStarted ? 'text-green-600' : 'text-red-600'}`}>
                  {queueStarted ? 'ACTIVE' : 'STOPPED'}
                </p>
                <p className="text-sm text-gray-600">Queue Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, Users } from 'lucide-react'
import { speak } from '@/lib/utils'

// Define types locally
type VivaQueue = {
  id: number;
  enrollment_number: string;
  queue_position: number;
  status: string;
};

type QueueStatus = {
  queueStarted: boolean;
  studentsToShow: number;
  currentBatchStart: number;
  totalStudents: number;
  currentStudents: VivaQueue[];
  timestamp: string;
};

export default function MonitorPage() {
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  // Keep track of previous enrollment numbers
  const prevNumbersRef = useRef<string[]>([])
  const firstAnnounceDone = useRef(false)

  // Poll the API every 3 seconds
  useEffect(() => {
    const interval: NodeJS.Timeout = setInterval(fetchStatus, 3000)
    let lastData: string | null = null

    async function fetchStatus() {
      const res = await fetch('/api/queue-status')
      if (!res.ok) return
      const data: QueueStatus = await res.json()
      // Only update if data changed
      const dataString = JSON.stringify(data)
      if (dataString !== lastData) {
        setQueueStatus(data)
        lastData = dataString
      }
    }
    fetchStatus()
    return () => clearInterval(interval)
  }, [])

  // Announce new numbers when currentStudents changes, only if TTS is enabled
  useEffect(() => {
    if (!ttsEnabled) return;
    if (!queueStatus || !queueStatus.currentStudents) return;
    const currentNumbers = queueStatus.currentStudents.map(s => s.enrollment_number);
    const prevNumbers = prevNumbersRef.current;
    const newNumbers = currentNumbers.filter(num => !prevNumbers.includes(num));

    if (!firstAnnounceDone.current) {
      // On first batch after enabling, just set the ref, don't announce
      prevNumbersRef.current = currentNumbers;
      firstAnnounceDone.current = true;
      return;
    }

    if (newNumbers.length > 0) {
      speak('New enrollment numbers are ' + newNumbers.join(', '));
    }
    prevNumbersRef.current = currentNumbers;
  }, [queueStatus?.currentStudents, ttsEnabled]);

  // Update time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timeInterval)
  }, [])

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--'
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* TTS Enable Button */}
        {!ttsEnabled && (
          <div className="flex justify-center mb-4">
            <button
              onClick={() => setTtsEnabled(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition"
            >
              🔊 Enable Announcements
            </button>
          </div>
        )}
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Viva Queue Monitor</h1>
          <div className="flex items-center justify-center gap-4 text-lg text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span className="font-mono">{formatTime(currentTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>Showing {queueStatus?.studentsToShow ?? '--'} students</span>
            </div>
          </div>
        </div>
        {/* Queue Status */}
        {!queueStatus ? (
          <Card className="border-2 border-gray-300">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="text-6xl">⏳</div>
                <h2 className="text-3xl font-bold text-gray-600">Loading queue status...</h2>
              </div>
            </CardContent>
          </Card>
        ) : !queueStatus.queueStarted ? (
          <Card className="border-2 border-gray-300">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="text-6xl">⏳</div>
                <h2 className="text-3xl font-bold text-gray-600">Queue Not Started</h2>
                <p className="text-lg text-gray-500">Please wait for the admin to start the viva queue</p>
              </div>
            </CardContent>
          </Card>
        ) : queueStatus.currentStudents.length === 0 ? (
          <Card className="border-2 border-green-300 bg-green-50">
            <CardContent className="py-12">
              <div className="text-center space-y-4">
                <div className="text-6xl">🎉</div>
                <h2 className="text-3xl font-bold text-green-600">All Students Completed</h2>
                <p className="text-lg text-green-500">The viva queue is now empty</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Current Students Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {queueStatus.currentStudents.map((student) => (
              <Card 
                key={student.id} 
                className="border-2 border-blue-300 bg-blue-50 transition-all duration-300 hover:shadow-lg"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-center">
                    <div className="text-2xl font-bold text-blue-700">
                      {student.enrollment_number}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-center space-y-2">
                    <div className="text-lg font-semibold text-blue-600">
                      Position: {student.queue_position}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Instructions */}
        {queueStatus && queueStatus.queueStarted && queueStatus.currentStudents.length > 0 && (
          <Card className="border-2 border-indigo-300 bg-indigo-50">
            <CardContent className="py-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-indigo-700">Current Batch</h3>
                <p className="text-indigo-600">
                  <span className="font-semibold">Students:</span> {queueStatus.currentStudents.map(s => s.enrollment_number).join(', ')}
                </p>
                <p className="text-sm text-indigo-500">
                  Total students remaining: {queueStatus.totalStudents}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>Viva Queue Management System • Updates automatically</p>
        </div>
      </div>
    </div>
  )
}
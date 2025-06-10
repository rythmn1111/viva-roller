import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../../utils/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Get system settings
    const { data: settings, error: settingsError } = await supabase
      .from('viva_system_settings')
      .select('*')

    if (settingsError) {
      console.error('Settings error:', settingsError)
      return res.status(500).json({ error: 'Failed to fetch settings' })
    }

    // Parse settings
    let currentBatchStart = 1
    let studentsToShow = 5
    let queueStarted = false

    if (settings) {
      settings.forEach((setting: any) => {
        switch (setting.setting_key) {
          case 'students_to_show':
            studentsToShow = parseInt(setting.setting_value) || 5
            break
          case 'current_batch_start':
            currentBatchStart = parseInt(setting.setting_value) || 1
            break
          case 'queue_started':
            queueStarted = setting.setting_value === 'true'
            break
        }
      })
    }

    // Get current students if queue is started
    let currentStudents = []
    let totalStudents = 0

    if (queueStarted) {
      // Get all waiting students
      const { data: allStudents, error: studentsError } = await supabase
        .from('viva_queue')
        .select('*')
        .eq('status', 'waiting')
        .order('queue_position')

      if (studentsError) {
        console.error('Students error:', studentsError)
        return res.status(500).json({ error: 'Failed to fetch students' })
      }

      totalStudents = allStudents?.length || 0

      if (allStudents && allStudents.length > 0) {
        // Get current batch
        currentStudents = allStudents.filter(student => 
          student.queue_position >= currentBatchStart && 
          student.queue_position <= (currentBatchStart + studentsToShow - 1)
        )
      }
    }

    // Return the data
    res.status(200).json({
      queueStarted,
      studentsToShow,
      currentBatchStart,
      totalStudents,
      currentStudents,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
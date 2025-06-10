import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [queue, setQueue] = useState<any>(null)

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const testConnection = async () => {
    addLog('Testing Supabase connection...')
    
    try {
      const { data, error } = await supabase
        .from('viva_system_settings')
        .select('*')
        .limit(1)
      
      if (error) {
        addLog(`ERROR: ${error.message}`)
      } else {
        addLog(`SUCCESS: Connected to Supabase`)
        addLog(`Data: ${JSON.stringify(data)}`)
      }
    } catch (err) {
      addLog(`CATCH ERROR: ${err}`)
    }
  }

  const loadSettings = async () => {
    addLog('Loading system settings...')
    
    try {
      const { data, error } = await supabase
        .from('viva_system_settings')
        .select('*')
      
      if (error) {
        addLog(`Settings ERROR: ${error.message}`)
      } else {
        addLog(`Settings SUCCESS: ${data.length} rows`)
        setSettings(data)
        data.forEach(setting => {
          addLog(`Setting: ${setting.setting_key} = ${setting.setting_value}`)
        })
      }
    } catch (err) {
      addLog(`Settings CATCH ERROR: ${err}`)
    }
  }

  const loadQueue = async () => {
    addLog('Loading queue data...')
    
    try {
      const { data, error } = await supabase
        .from('viva_queue')
        .select('*')
        .order('queue_position')
      
      if (error) {
        addLog(`Queue ERROR: ${error.message}`)
      } else {
        addLog(`Queue SUCCESS: ${data.length} students`)
        setQueue(data)
        data.slice(0, 5).forEach(student => {
          addLog(`Student: ${student.enrollment_number} - Pos: ${student.queue_position} - Status: ${student.status}`)
        })
      }
    } catch (err) {
      addLog(`Queue CATCH ERROR: ${err}`)
    }
  }

  const testRealtime = async () => {
    addLog('Testing realtime subscription...')
    
    const subscription = supabase
      .channel('debug_test')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'viva_system_settings' }, 
        (payload) => {
          addLog(`Realtime update: ${JSON.stringify(payload)}`)
        }
      )
      .subscribe((status) => {
        addLog(`Subscription status: ${status}`)
      })

    setTimeout(() => {
      subscription.unsubscribe()
      addLog('Realtime test completed')
    }, 5000)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Debug Tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={testConnection}>Test Connection</Button>
              <Button onClick={loadSettings}>Load Settings</Button>
              <Button onClick={loadQueue}>Load Queue</Button>
              <Button onClick={testRealtime}>Test Realtime</Button>
              <Button onClick={() => setLogs([])} variant="outline">Clear Logs</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
              {settings ? JSON.stringify(settings, null, 2) : 'Click "Load Settings" to see data'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
              {queue ? JSON.stringify(queue.slice(0, 10), null, 2) : 'Click "Load Queue" to see data'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-auto">
              {logs.length === 0 ? (
                <div>No logs yet. Click the buttons above to start debugging.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index}>{log}</div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
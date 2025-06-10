import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const speak = (text: string) => {
  console.log('Speak function called with:', text)
  
  if (typeof window === 'undefined') {
    console.log('Window is undefined - server side')
    return
  }
  
  if (!('speechSynthesis' in window)) {
    console.log('Speech synthesis not supported in this browser')
    return
  }
  
  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel()
    
    // Small delay to ensure cancel is processed
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.volume = 1
      utterance.rate = 0.8
      utterance.pitch = 1
      utterance.lang = 'en-US'
      
      utterance.onstart = () => console.log('Speech started')
      utterance.onend = () => console.log('Speech ended')
      utterance.onerror = (e) => console.error('Speech error:', e)
      
      console.log('Speaking:', text)
      window.speechSynthesis.speak(utterance)
    }, 100)
    
  } catch (error) {
    console.error('Error in speak function:', error)
  }
}
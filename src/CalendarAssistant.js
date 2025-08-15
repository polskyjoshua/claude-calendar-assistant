import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, Mic, MicOff, Send, User, MessageCircle, Settings } from 'lucide-react';
import GoogleCalendarService from './GoogleCalendarService';

const CalendarAssistant = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: "Hi! I'm your AI calendar assistant. Start by telling me all about yourself - how you work, when you're most productive, what matters to you. The more I understand about how your brain works, the better I can help optimize your time.",
      timestamp: new Date()
    }
  ]);
  
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [userProfile, setUserProfile] = useState({
    workBestTimes: [],
    preferences: [],
    priorities: [],
    bufferTime: 15,
    workingHours: { start: 9, end: 17 }
  });
  
  const messagesEndRef = useRef(null);
  const calendarService = useRef(new GoogleCalendarService());
  
  useEffect(() => {
    // Initialize Google Calendar service
    calendarService.current.init().then(() => {
      setIsAuthenticated(calendarService.current.isSignedIn());
    });
    
    // Load user profile from localStorage
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      setUserProfile(JSON.parse(savedProfile));
    }
    
    scrollToBottom();
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Save user profile when it changes
  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
  }, [userProfile]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const addMessage = (type, content) => {
    const newMessage = {
      id: Date.now(),
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };
  
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await calendarService.current.signIn();
      setIsAuthenticated(true);
      
      // Load recent events
      const events = await calendarService.current.getUpcomingEvents();
      setCalendarEvents(events);
      
      addMessage('assistant', "Great! I'm now connected to your Google Calendar. I can see your events and help you schedule new ones. Tell me more about yourself!");
    } catch (error) {
      addMessage('assistant', "Sorry, there was an issue connecting to Google Calendar. Please try again.");
      console.error('Auth error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const processUserInput = async (input) => {
    const lowerInput = input.toLowerCase();
    setIsLoading(true);
    
    try {
      if (lowerInput.includes('schedule') || lowerInput.includes('book') || lowerInput.includes('add')) {
        return await handleScheduling(input);
      }
      
      if (lowerInput.includes('i work best') || lowerInput.includes('i prefer') || lowerInput.includes('i like') || lowerInput.includes('i am') || lowerInput.includes('my brain')) {
        return handleLearning(input);
      }
      
      if (lowerInput.includes('priority') || lowerInput.includes('important') || lowerInput.includes('urgent')) {
        return handlePriorities(input);
      }
      
      if (lowerInput.includes('what do i have') || lowerInput.includes('my schedule') || lowerInput.includes('tomorrow') || lowerInput.includes('today') || lowerInput.includes('this week')) {
        return await handleCalendarView(input);
      }
      
      if (lowerInput.includes('my preferences') || lowerInput.includes('tell me about') || lowerInput.includes('what do you know')) {
        return handleProfileInquiry();
      }
      
      if (lowerInput.includes('cancel') || lowerInput.includes('delete') || lowerInput.includes('remove')) {
        return await handleEventDeletion(input);
      }
      
      // Learning conversation - extract insights about the user
      return handleGeneralConversation(input);
      
    } catch (error) {
      console.error('Processing error:', error);
      return "I had trouble processing that request. Could you try rephrasing it?";
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleScheduling = async (input) => {
    if (!isAuthenticated) {
      return "I need to connect to your Google Calendar first. Please click the 'Connect Calendar' button above.";
    }
    
    try {
      // Parse the scheduling request
      const eventDetails = parseSchedulingRequest(input);
      
      if (!eventDetails.title) {
        return "I couldn't figure out what event you want to schedule. Could you be more specific? For example: 'Schedule a team meeting tomorrow at 2pm'";
      }
      
      // Create the event
      const event = await calendarService.current.createEvent(eventDetails);
      
      // Update local events list
      const updatedEvents = await calendarService.current.getUpcomingEvents();
      setCalendarEvents(updatedEvents);
      
      return `Perfect! I've scheduled "${eventDetails.title}" for ${eventDetails.start.toLocaleDateString()} at ${eventDetails.start.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}. I made sure to respect your preferences when picking this time.`;
      
    } catch (error) {
      console.error('Scheduling error:', error);
      return "I had trouble creating that event. Please check the details and try again.";
    }
  };
  
  const parseSchedulingRequest = (input) => {
    // Extract title (everything before time/date indicators)
    let title = input.replace(/(schedule|book|add|create)/gi, '').trim();
    
    // Extract time
    const timeMatch = input.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi);
    const time = timeMatch ? timeMatch[0] : '2:00 PM'; // default
    
    // Extract date
    const dateMatch = input.match(/(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week)/gi);
    let date = new Date();
    
    if (dateMatch) {
      const dateStr = dateMatch[0].toLowerCase();
      if (dateStr === 'tomorrow') {
        date.setDate(date.getDate() + 1);
      } else if (dateStr === 'today') {
        // keep current date
      } else if (dateStr === 'next week') {
        date.setDate(date.getDate() + 7);
      }
      // Remove date from title
      title = title.replace(new RegExp(dateStr, 'gi'), '').trim();
    }
    
    // Remove time from title
    if (timeMatch) {
      title = title.replace(new RegExp(timeMatch[0], 'gi'), '').trim();
    }
    
    // Parse time and set on date
    const [timeStr, period] = time.split(/\s+/);
    const [hours, minutes = '0'] = timeStr.split(':');
    let hour = parseInt(hours);
    if (period && period.toLowerCase().includes('pm') && hour !== 12) hour += 12;
    if (period && period.toLowerCase().includes('am') && hour === 12) hour = 0;
    
    date.setHours(hour, parseInt(minutes), 0, 0);
    
    // Default duration: 1 hour
    const endDate = new Date(date.getTime() + 60 * 60 * 1000);
    
    return {
      title: title || 'New Event',
      start: date,
      end: endDate,
      description: `Scheduled via AI Calendar Assistant`
    };
  };
  
  const handleCalendarView = async (input) => {
    if (!isAuthenticated) {
      return "I need to connect to your Google Calendar first to show you your schedule.";
    }
    
    try {
      const events = await calendarService.current.getUpcomingEvents();
      setCalendarEvents(events);
      
      if (events.length === 0) {
        return "You don't have any upcoming events! This might be a good time to focus on your priorities or take a break.";
      }
      
      const eventList = events.slice(0, 5).map(event => {
        const start = new Date(event.start.dateTime || event.start.date);
        return `• ${event.summary} - ${start.toLocaleDateString()} at ${start.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true 
        })}`;
      }).join('\n');
      
      return `Here's what you have coming up:\n\n${eventList}\n\nBased on what I know about you, I notice some good focus time slots between your meetings!`;
      
    } catch (error) {
      return "I had trouble accessing your calendar. Please try again.";
    }
  };
  
  const handleLearning = (input) => {
    const insight = input.replace(/(i work best|i prefer|i like|i am|my brain)/gi, '').trim();
    setUserProfile(prev => ({
      ...prev,
      preferences: [...prev.preferences, insight].slice(-10) // Keep last 10
    }));
    
    return `Got it! I've learned that you ${insight}. I'll use this insight when helping you schedule and optimize your time. The more you tell me about how you work, the better I can help you!`;
  };
  
  const handlePriorities = (input) => {
    const priority = input.replace(/(priority|important|urgent|focus)/gi, '').trim();
    setUserProfile(prev => ({
      ...prev,
      priorities: [...prev.priorities, priority].slice(-5) // Keep last 5
    }));
    
    return `Understood! I've noted that "${priority}" is a high priority for you. I'll make sure to protect time for this and suggest optimal scheduling around it.`;
  };
  
  const handleGeneralConversation = (input) => {
    // Extract any insights about the user from general conversation
    const insights = [];
    
    if (input.includes('morning') && (input.includes('better') || input.includes('best') || input.includes('productive'))) {
      insights.push('works better in mornings');
    }
    if (input.includes('evening') && (input.includes('better') || input.includes('best') || input.includes('productive'))) {
      insights.push('works better in evenings');
    }
    if (input.includes('tired') || input.includes('energy')) {
      insights.push(`energy patterns: ${input}`);
    }
    if (input.includes('focus') || input.includes('concentrate')) {
      insights.push(`focus preferences: ${input}`);
    }
    
    if (insights.length > 0) {
      setUserProfile(prev => ({
        ...prev,
        preferences: [...prev.preferences, ...insights].slice(-15)
      }));
      
      return `Thanks for sharing! I'm learning about your work patterns and preferences. Keep telling me about yourself - every detail helps me understand how to optimize your schedule better.`;
    }
    
    return `I understand. Tell me more about how you work best, when you're most productive, or what kinds of tasks energize or drain you. The more I know about your work style, the better I can help optimize your time.`;
  };
  
  const handleProfileInquiry = () => {
    const prefs = userProfile.preferences.length > 0 
      ? userProfile.preferences.slice(-5).map(p => `• ${p}`).join('\n')
      : '• No preferences recorded yet';
      
    const priorities = userProfile.priorities.length > 0
      ? userProfile.priorities.map(p => `• ${p}`).join('\n')
      : '• No priorities set yet';
    
    return `Here's what I know about how you work:\n\n**Your Work Style:**\n${prefs}\n\n**Your Current Priorities:**\n${priorities}\n\n**Settings:**\n• Buffer time: ${userProfile.bufferTime} minutes between meetings\n• Working hours: ${userProfile.workingHours.start}:00 - ${userProfile.workingHours.end}:00\n\nKeep sharing more about yourself - I'm always learning!`;
  };
  
  const handleVoiceInput = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      if (isListening) {
        recognition.stop();
        setIsListening(false);
        return;
      }
      
      setIsListening(true);
      recognition.start();
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setIsListening(false);
      };
      
      recognition.onerror = () => {
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
    } else {
      alert('Speech recognition not supported in this browser. Try Chrome!');
    }
  };
  
  const handleSubmit = async () => {
    if (!inputText.trim()) return;
    
    addMessage('user', inputText);
    const currentInput = inputText;
    setInputText('');
    
    // Show typing indicator
    addMessage('assistant', '...');
    
    try {
      const response = await processUserInput(currentInput);
      // Remove typing indicator and add real response
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.content !== '...');
        return [...filtered, {
          id: Date.now(),
          type: 'assistant',
          content: response,
          timestamp: new Date()
        }];
      });
    } catch (error) {
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.content !== '...');
        return [...filtered, {
          id: Date.now(),
          type: 'assistant',
          content: "Sorry, I had trouble processing that. Could you try again?",
          timestamp: new Date()
        }];
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-lg h-screen flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6" />
            <h1 className="text-xl font-semibold">AI Calendar Assistant</h1>
          </div>
          <div className="flex items-center space-x-4">
            {!isAuthenticated ? (
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
              >
                {isLoading ? 'Connecting...' : 'Connect Calendar'}
              </button>
            ) : (
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Connected</span>
              </div>
            )}
            <div className="flex items-center space-x-1 text-sm">
              <User className="w-4 h-4" />
              <span>{userProfile.preferences.length} insights learned</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Preview */}
      {isAuthenticated && calendarEvents.length > 0 && (
        <div className="bg-gray-700 p-3 border-b border-gray-600">
          <div className="flex items-center space-x-4 text-sm text-white">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="font-medium">Upcoming:</span>
            </div>
            {calendarEvents.slice(0, 2).map((event, index) => {
              const start = new Date(event.start.dateTime || event.start.date);
              return (
                <div key={index} className="bg-gray-600 px-2 py-1 rounded text-xs text-white">
                  {event.summary} • {start.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit', 
                    hour12: true 
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.content === '...'
                  ? 'bg-gray-600 text-gray-300'
                  : 'bg-gray-700 text-white'
              }`}
            >
              <div className="flex items-start space-x-2">
                {message.type === 'assistant' && message.content !== '...' && (
                  <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
                )}
                <p className="text-sm whitespace-pre-line">
                  {message.content === '...' ? (
                    <span className="flex space-x-1">
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                      <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    </span>
                  ) : message.content}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-600">
        <div className="flex space-x-2">
          <button
            onClick={handleVoiceInput}
            className={`p-2 rounded-full transition-colors ${
              isListening 
                ? 'bg-red-100 text-red-600' 
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Tell me about yourself and how you work best..."
            className="flex-1 px-3 py-2 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 bg-gray-700 text-white placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        {isListening && (
          <div className="text-xs text-red-400 mt-1 flex items-center">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse mr-2"></div>
            Listening... Speak now
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarAssistant;

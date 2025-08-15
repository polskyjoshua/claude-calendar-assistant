class GoogleCalendarService {
  constructor() {
    this.gapi = null;
    this.isInitialized = false;
    this.isSignedIn = false;
  }

  async init() {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        this.gapi = window.gapi;
        this.gapi.load('client:auth2', async () => {
          try {
            await this.gapi.client.init({
              apiKey: process.env.REACT_APP_GOOGLE_API_KEY,
              clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
              scope: 'https://www.googleapis.com/auth/calendar'
            });
            
            this.isInitialized = true;
            this.isSignedIn = this.gapi.auth2.getAuthInstance().isSignedIn.get();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      } else {
        // Load Google API script
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => this.init().then(resolve).catch(reject);
        script.onerror = reject;
        document.head.appendChild(script);
      }
    });
  }

  async signIn() {
    if (!this.isInitialized) {
      throw new Error('Google API not initialized');
    }
    
    const authInstance = this.gapi.auth2.getAuthInstance();
    await authInstance.signIn();
    this.isSignedIn = true;
  }

  isSignedIn() {
    return this.isSignedIn && this.gapi?.auth2?.getAuthInstance()?.isSignedIn?.get();
  }

  async getUpcomingEvents(maxResults = 10) {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in');
    }

    const response = await this.gapi.client.calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    });

    return response.result.items || [];
  }

  async createEvent(eventDetails) {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in');
    }

    const event = {
      summary: eventDetails.title,
      description: eventDetails.description || '',
      start: {
        dateTime: eventDetails.start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: eventDetails.end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    const response = await this.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event
    });

    return response.result;
  }

  async deleteEvent(eventId) {
    if (!this.isSignedIn()) {
      throw new Error('Not signed in');
    }

    const response = await this.gapi.client.calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });

    return response;
  }
}

export default GoogleCalendarService;

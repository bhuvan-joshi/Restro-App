import * as signalR from '@microsoft/signalr';
import { SIGNALR_URL } from '../config/api.config';

let connection: signalR.HubConnection;

export const startSignalRConnection = async () => {
  try {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(SIGNALR_URL, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    await connection.start();
    console.log('SignalR connection established');
    return connection;
  } catch (error) {
    console.error('Error establishing SignalR connection:', error);
    throw error;
  }
};

export const onCrawlProgressUpdate = (callback: (progress: any) => void) => {
  if (!connection) {
    throw new Error('SignalR connection not established');
  }
  
  connection.on('CrawlProgressUpdate', (data) => {
    callback(data);
  });
};

export const stopSignalRConnection = async () => {
  if (connection) {
    await connection.stop();
    console.log('SignalR connection stopped');
  }
};
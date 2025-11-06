import twilio from 'twilio';
import { nanoid } from 'nanoid';
import type { TwilioConversation, InsertTwilioConversation, TwilioMessage, InsertTwilioMessage } from '@shared/schema';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.warn('⚠️  Twilio credentials not configured. Multi-channel messaging will be unavailable.');
}

export class TwilioConversationsService {
  private client: twilio.Twilio | null = null;

  constructor() {
    if (accountSid && authToken) {
      this.client = twilio(accountSid, authToken);
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async createConversation(
    friendlyName: string,
    channel: 'sms' | 'whatsapp' | 'email',
    participantAddress: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    const conversation = await this.client.conversations.v1.conversations.create({
      friendlyName,
      attributes: JSON.stringify({
        channel,
        participantAddress,
        createdAt: new Date().toISOString()
      })
    });

    return conversation.sid;
  }

  async addParticipant(
    conversationSid: string,
    address: string,
    channel: 'sms' | 'whatsapp' | 'email'
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    const params: any = {};

    if (channel === 'sms') {
      params['messagingBinding.address'] = address;
      params['messagingBinding.proxyAddress'] = process.env.TWILIO_PHONE_NUMBER;
    } else if (channel === 'whatsapp') {
      params['messagingBinding.address'] = `whatsapp:${address}`;
      params['messagingBinding.proxyAddress'] = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER}`;
    }

    await this.client.conversations.v1
      .conversations(conversationSid)
      .participants.create(params);
  }

  async sendMessage(
    conversationSid: string,
    body: string,
    author: string = 'system',
    contentType?: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    const messageParams: any = {
      author,
    };

    // For HTML email content, use xTwilioEmail content type
    if (contentType === 'text/html') {
      messageParams['xTwilioEmail'] = JSON.stringify({
        body: body,
        subject: 'Query Results - Natural Language Database Chatbot'
      });
    } else {
      messageParams.body = body;
    }

    const message = await this.client.conversations.v1
      .conversations(conversationSid)
      .messages.create(messageParams);

    return message.sid;
  }

  async getConversation(conversationSid: string) {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    return await this.client.conversations.v1.conversations(conversationSid).fetch();
  }

  async getConversationMessages(conversationSid: string) {
    if (!this.client) {
      throw new Error('Twilio client not configured');
    }

    const messages = await this.client.conversations.v1
      .conversations(conversationSid)
      .messages.list({ limit: 100 });

    return messages;
  }

  formatResponseForChannel(response: any, channel: 'sms' | 'whatsapp' | 'email'): string {
    if (channel === 'sms') {
      return this.formatSMSResponse(response);
    } else if (channel === 'whatsapp') {
      return this.formatWhatsAppResponse(response);
    } else {
      return this.formatEmailResponse(response);
    }
  }

  private formatSMSResponse(response: any): string {
    const { data, row_count, summary, ai_insights, error } = response;

    if (error) {
      return `❌ Error: ${error}`;
    }

    let message = '';

    if (ai_insights) {
      message += `${ai_insights}\n\n`;
    }

    if (summary) {
      message += `📊 Summary:\n`;
      if (summary.total_records) message += `Records: ${summary.total_records}\n`;
      if (summary.total_value) message += `Total: $${summary.total_value.toLocaleString()}\n`;
      if (summary.avg_fee) message += `Avg Fee: $${summary.avg_fee.toLocaleString()}\n`;
      if (summary.avg_win_rate) message += `Win Rate: ${(summary.avg_win_rate * 100).toFixed(1)}%\n`;
      message += '\n';
    }

    if (data && data.length > 0) {
      const topResults = data.slice(0, 3);
      message += `Top ${Math.min(3, data.length)} Results:\n`;
      topResults.forEach((row: any, idx: number) => {
        const projectName = row.project_name || row.name || 'N/A';
        const fee = row.total_fee || row.fee || 0;
        message += `${idx + 1}. ${projectName}: $${fee.toLocaleString()}\n`;
      });

      if (data.length > 3) {
        message += `\n...and ${data.length - 3} more results`;
      }
    }

    return message.trim() || '✅ Query executed successfully';
  }

  private formatWhatsAppResponse(response: any): string {
    const { data, summary, ai_insights, error } = response;

    if (error) {
      return `❌ *Error*: ${error}`;
    }

    let message = '';

    if (ai_insights) {
      message += `💡 *Insights*\n${ai_insights}\n\n`;
    }

    if (summary) {
      message += `📊 *Summary*\n`;
      if (summary.total_records) message += `• Records: *${summary.total_records}*\n`;
      if (summary.total_value) message += `• Total Value: *$${summary.total_value.toLocaleString()}*\n`;
      if (summary.avg_fee) message += `• Average Fee: *$${summary.avg_fee.toLocaleString()}*\n`;
      if (summary.avg_win_rate) message += `• Win Rate: *${(summary.avg_win_rate * 100).toFixed(1)}%*\n`;
      message += '\n';
    }

    if (data && data.length > 0) {
      const topResults = data.slice(0, 5);
      message += `🔝 *Top ${Math.min(5, data.length)} Results*\n`;
      topResults.forEach((row: any, idx: number) => {
        const projectName = row.project_name || row.name || 'N/A';
        const fee = row.total_fee || row.fee || 0;
        message += `${idx + 1}. *${projectName}*: $${fee.toLocaleString()}\n`;
      });

      if (data.length > 5) {
        message += `\n_...and ${data.length - 5} more results_`;
      }
    }

    return message.trim() || '✅ Query executed successfully';
  }

  private formatEmailResponse(response: any): string {
    const { data, summary, ai_insights, error, sql_query } = response;

    if (error) {
      return `Error: ${error}`;
    }

    let html = '<html><body style="font-family: Arial, sans-serif;">';

    if (ai_insights) {
      html += `<h2>📊 Analysis</h2><p>${ai_insights}</p>`;
    }

    if (summary) {
      html += '<h3>Summary Statistics</h3><ul>';
      if (summary.total_records) html += `<li><strong>Total Records:</strong> ${summary.total_records}</li>`;
      if (summary.total_value) html += `<li><strong>Total Value:</strong> $${summary.total_value.toLocaleString()}</li>`;
      if (summary.avg_fee) html += `<li><strong>Average Fee:</strong> $${summary.avg_fee.toLocaleString()}</li>`;
      if (summary.avg_win_rate) html += `<li><strong>Win Rate:</strong> ${(summary.avg_win_rate * 100).toFixed(1)}%</li>`;
      html += '</ul>';
    }

    if (data && data.length > 0) {
      html += `<h3>Results (${data.length} records)</h3>`;
      html += '<table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">';
      
      const headers = Object.keys(data[0]);
      html += '<thead><tr>';
      headers.forEach(header => {
        html += `<th style="background-color: #f0f0f0;">${header}</th>`;
      });
      html += '</tr></thead><tbody>';

      const topResults = data.slice(0, 10);
      topResults.forEach((row: any) => {
        html += '<tr>';
        headers.forEach(header => {
          const value = row[header];
          const displayValue = typeof value === 'number' ? value.toLocaleString() : (value || 'N/A');
          html += `<td>${displayValue}</td>`;
        });
        html += '</tr>';
      });

      html += '</tbody></table>';

      if (data.length > 10) {
        html += `<p><em>Showing top 10 of ${data.length} total results</em></p>`;
      }
    }

    if (sql_query) {
      html += `<h3>SQL Query</h3><pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${sql_query}</pre>`;
    }

    html += '</body></html>';
    return html;
  }
}

export const twilioService = new TwilioConversationsService();

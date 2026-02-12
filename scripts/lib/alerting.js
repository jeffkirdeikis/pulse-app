/**
 * Alerting Module
 *
 * Sends data quality alerts via Telegram
 *
 * Setup:
 * 1. Create a Telegram bot via @BotFather
 * 2. Get your chat ID by messaging @userinfobot
 * 3. Add to .env.local:
 *    TELEGRAM_BOT_TOKEN=your_bot_token
 *    TELEGRAM_CHAT_ID=your_chat_id
 */

/**
 * Send a Telegram message
 */
async function sendTelegramAlert(message, options = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('⚠️  Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local');
    console.log('Alert would have been:', message);
    return false;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram alert:', error.message);
    return false;
  }
}

/**
 * Format data quality alert for Telegram
 */
function formatDataQualityAlert(issues, eventCount) {
  const highSeverity = issues.filter(i => i.severity === 'HIGH');
  const mediumSeverity = issues.filter(i => i.severity === 'MEDIUM');

  let message = `🚨 <b>PULSE DATA QUALITY ALERT</b>\n\n`;
  message += `Scanned: ${eventCount} events\n`;
  message += `🔴 High severity: ${highSeverity.length}\n`;
  message += `🟡 Medium severity: ${mediumSeverity.length}\n\n`;

  if (highSeverity.length > 0) {
    message += `<b>Critical Issues:</b>\n`;

    // Group by type
    const byType = {};
    for (const issue of highSeverity) {
      if (!byType[issue.type]) byType[issue.type] = [];
      byType[issue.type].push(issue);
    }

    for (const [type, typeIssues] of Object.entries(byType)) {
      message += `\n• <b>${type}</b> (${typeIssues.length})\n`;
      for (const issue of typeIssues.slice(0, 3)) {
        message += `  - ${escapeHtml(issue.message.substring(0, 60))}\n`;
      }
      if (typeIssues.length > 3) {
        message += `  ... and ${typeIssues.length - 3} more\n`;
      }
    }
  }

  message += `\n<i>Run: npm run validate:events:fix</i>`;

  return message;
}

/**
 * Format scraper completion alert
 */
function formatScraperAlert(scraperName, stats) {
  let emoji = stats.errors > 0 ? '⚠️' : '✅';

  let message = `${emoji} <b>Scraper: ${scraperName}</b>\n\n`;
  message += `New events: ${stats.newEvents || 0}\n`;
  message += `Skipped (duplicate): ${stats.duplicates || 0}\n`;
  message += `Skipped (invalid): ${stats.invalid || 0}\n`;
  message += `Errors: ${stats.errors || 0}\n`;

  if (stats.errors > 0) {
    message += `\n<i>Check logs for details</i>`;
  }

  return message;
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send data quality alert
 */
async function alertDataQualityIssues(issues, eventCount) {
  if (issues.length === 0) return true;

  const message = formatDataQualityAlert(issues, eventCount);
  return sendTelegramAlert(message);
}

/**
 * Send scraper completion alert
 */
async function alertScraperComplete(scraperName, stats) {
  // Only alert if there are errors or significant new data
  if (stats.errors === 0 && (stats.newEvents || 0) < 10) {
    return true; // Silent success for routine runs
  }

  const message = formatScraperAlert(scraperName, stats);
  return sendTelegramAlert(message);
}

/**
 * Send custom alert
 */
async function alert(title, body, severity = 'info') {
  const emoji = {
    'info': 'ℹ️',
    'warning': '⚠️',
    'error': '🚨',
    'success': '✅',
  }[severity] || 'ℹ️';

  const message = `${emoji} <b>${escapeHtml(title)}</b>\n\n${escapeHtml(body)}`;
  return sendTelegramAlert(message);
}

export {
  sendTelegramAlert,
  alertDataQualityIssues,
  alertScraperComplete,
  alert,
  formatDataQualityAlert,
  formatScraperAlert,
};

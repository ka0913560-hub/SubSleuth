// background.js — service worker (Manifest V3)
const STORAGE_KEY = 'subs_sst';
const CONFIG_KEY = 'subs_config';
const DEFAULT_NOTIFY_DAYS = 3; // Default number of days before billing date to notify

// CURRENCY CONFIGURATION
// Current configuration: Indian Rupees (₹) with Indian number formatting (e.g., ₹1,23,456.00)
// To change the currency, modify the formatMoney() function below

// Parse date string (yyyy-mm-dd) into Date object
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Try to parse the ISO date string
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) return date;
  
  return null;
}

// Format money values
function formatMoney(n) {
  // Use Intl.NumberFormat for Indian Rupee formatting with en-IN locale
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(n || 0));
}

// Calculate the reminder date based on billing date and notify days
function calculateReminderDate(billingDate, notifyBeforeDays = DEFAULT_NOTIFY_DAYS) {
  const reminderDate = new Date(billingDate);
  reminderDate.setDate(reminderDate.getDate() - notifyBeforeDays);
  return reminderDate;
}

// Show notification helper
function showNotification(sub, isTest = false) {
  // Format the frequency display nicely (capitalize first letter)
  const freqDisplay = sub.frequency.charAt(0).toUpperCase() + sub.frequency.slice(1);
  
  // Format the date to be more readable
  const nextDate = new Date(sub.nextBilling);
  const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  const formattedDate = nextDate.toLocaleDateString(undefined, dateOptions);
  
  let title, message;
  
  if (isTest) {
    title = `Test Notification: ${sub.name}`;
    message = `This is a test reminder for ${sub.name} (${formatMoney(sub.amount)} ${freqDisplay}).\nActual billing date: ${formattedDate}`;
  } else {
    title = `Subscription coming due: ${sub.name}`;
    message = `${sub.name} (${formatMoney(sub.amount)} ${freqDisplay}) is due on ${formattedDate}`;
  }
  
  const options = {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 2
  };
  
  chrome.notifications.create('notif_' + sub.id + (isTest ? '_test' : ''), options);
}

// Get the notification days setting
async function getNotifyDays() {
  return new Promise(resolve => {
    chrome.storage.local.get([CONFIG_KEY], res => {
      const config = res[CONFIG_KEY] || {};
      resolve(config.notifyBeforeDays || DEFAULT_NOTIFY_DAYS);
    });
  });
}

// Create or update an alarm for a subscription
async function createAlarmForSubscription(sub, isTestMode = false) {
  try {
    const alarmName = 'remind_' + sub.id;
    
    // Clear any existing alarm with this name
    await chrome.alarms.clear(alarmName);
    
    if (isTestMode) {
      // For test mode, set alarm to 1 minute from now
      console.log(`Creating test alarm for ${sub.name} - will fire in 1 minute`);
      chrome.alarms.create(alarmName + '_test', { delayInMinutes: 1 });
      return true;
    }
    
    const billingDate = parseDate(sub.nextBilling);
    if (!billingDate) {
      console.error(`Invalid billing date for subscription: ${sub.name}`);
      return false;
    }
    
    const notifyDays = await getNotifyDays();
    const reminderDate = calculateReminderDate(billingDate, notifyDays);
    const now = new Date();
    
    // Only create alarm if reminder date is in the future
    if (reminderDate > now) {
      console.log(`Creating alarm for ${sub.name} - will fire on ${reminderDate.toLocaleString()}`);
      chrome.alarms.create(alarmName, { when: reminderDate.getTime() });
      return true;
    } else {
      console.log(`Skipping alarm for ${sub.name} - reminder date ${reminderDate.toLocaleString()} is in the past`);
      return false;
    }
  } catch (e) {
    console.error('Error creating alarm:', e);
    return false;
  }
}

// Delete an alarm for a subscription
async function deleteAlarmForSubscription(subId) {
  try {
    const alarmName = 'remind_' + subId;
    await chrome.alarms.clear(alarmName);
    return true;
  } catch (e) {
    console.error('Error deleting alarm:', e);
    return false;
  }
}

// On install or when asked to sync, create alarms for nextBilling of each subscription
async function syncAlarms() {
  console.log("Syncing all alarms");
  try {
    const result = await new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY], res => {
        resolve(res[STORAGE_KEY] || []);
      });
    });
    
    const subs = result;
    
    // Clear all remind_ alarms first
    const alarms = await chrome.alarms.getAll();
    for (const alarm of alarms) {
      if (alarm.name && alarm.name.startsWith('remind_')) {
        await chrome.alarms.clear(alarm.name);
      }
    }
    
    // Create alarms for each subscription
    const notifyDays = await getNotifyDays();
    for (const sub of subs) {
      await createAlarmForSubscription(sub);
    }
    
    console.log(`Synced alarms for ${subs.length} subscriptions`);
    return true;
  } catch (e) {
    console.error('Error syncing alarms:', e);
    return false;
  }
}

// When an alarm fires, find the subscription and notify
chrome.alarms.onAlarm.addListener(async alarm => {
  try {
    if (!alarm || !alarm.name) return;
    
    console.log(`Alarm triggered: ${alarm.name}`);
    
    // Handle test alarms
    if (alarm.name.includes('_test')) {
      const id = alarm.name.replace('remind_', '').replace('_test', '');
      chrome.storage.local.get([STORAGE_KEY], res => {
        const subs = res[STORAGE_KEY] || [];
        const s = subs.find(x => x.id === id);
        if (s) showNotification(s, true);
      });
      return;
    }
    
    // Handle regular alarms
    if (alarm.name.startsWith('remind_')) {
      const id = alarm.name.replace('remind_', '');
      chrome.storage.local.get([STORAGE_KEY], res => {
        const subs = res[STORAGE_KEY] || [];
        const s = subs.find(x => x.id === id);
        if (s) showNotification(s);
      });
    }
  } catch (e) {
    console.error('Alarm handler error:', e);
  }
});

// Set notification preference
async function setNotifyDays(days) {
  return new Promise(resolve => {
    chrome.storage.local.get([CONFIG_KEY], res => {
      const config = res[CONFIG_KEY] || {};
      config.notifyBeforeDays = days;
      
      const obj = {};
      obj[CONFIG_KEY] = config;
      chrome.storage.local.set(obj, () => {
        syncAlarms(); // Re-sync alarms with new setting
        resolve(true);
      });
    });
  });
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed - initializing");
  
  // Initialize config if needed
  chrome.storage.local.get([CONFIG_KEY], res => {
    if (!res[CONFIG_KEY]) {
      const defaultConfig = {
        notifyBeforeDays: DEFAULT_NOTIFY_DAYS
      };
      
      const obj = {};
      obj[CONFIG_KEY] = defaultConfig;
      chrome.storage.local.set(obj);
    }
  });
  
  // Sync alarms
  syncAlarms();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received:", message);
  
  switch(message.action) {
    case 'syncAlarms':
      syncAlarms().then(result => sendResponse({ success: result }));
      return true; // Keep the messaging channel open for async response
      
    case 'createAlarm':
      createAlarmForSubscription(message.subscription)
        .then(result => sendResponse({ success: result }));
      return true;
      
    case 'testAlarm':
      createAlarmForSubscription(message.subscription, true)
        .then(result => sendResponse({ success: result }));
      return true;
      
    case 'deleteAlarm':
      deleteAlarmForSubscription(message.subscriptionId)
        .then(result => sendResponse({ success: result }));
      return true;
      
    case 'setNotifyDays':
      setNotifyDays(message.days)
        .then(result => sendResponse({ success: result }));
      return true;
      
    case 'getAlarms':
      chrome.alarms.getAll(alarms => {
        sendResponse({ alarms });
      });
      return true;
  }
});

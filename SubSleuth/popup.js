// popup.js — manage UI, storage, and scheduling reminders

const STORAGE_KEY = 'subs_sst';
const CONFIG_KEY = 'subs_config';
const DEFAULT_NOTIFY_DAYS = 3;

// CURRENCY CONFIGURATION
// Current configuration: Indian Rupees (₹) with Indian number formatting (e.g., ₹1,23,456.00)
// To change the currency, modify the formatMoney() function by updating:
// 1. The locale (e.g., 'en-IN' for India, 'en-US' for US, 'de-DE' for Germany)
// 2. The currency code (e.g., 'INR' for Indian Rupee, 'USD' for US Dollar, 'EUR' for Euro)
// Example for US Dollars: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function $(id){return document.getElementById(id)}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
}

// Get notification days setting
async function getNotifyDays() {
  return new Promise(resolve => {
    chrome.storage.local.get([CONFIG_KEY], res => {
      const config = res[CONFIG_KEY] || {};
      resolve(config.notifyBeforeDays || DEFAULT_NOTIFY_DAYS);
    });
  });
}

// Set notification days setting and update display
async function setNotifyDays(days) {
  return new Promise(resolve => {
    const numDays = Number(days) || DEFAULT_NOTIFY_DAYS;
    
    chrome.runtime.sendMessage({
      action: 'setNotifyDays',
      days: numDays
    }, response => {
      if (response && response.success) {
        // Update the display
        $('notifyDaysText').textContent = numDays;
        resolve(true);
      } else {
        console.error('Failed to set notification days');
        resolve(false);
      }
    });
  });
}

async function getSubs(){
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], res => {
      resolve(res[STORAGE_KEY] || []);
    });
  });
}

async function saveSubs(subs){
  return new Promise(resolve => {
    const obj = {};
    obj[STORAGE_KEY] = subs;
    chrome.storage.local.set(obj, () => resolve());
  });
}

function toMonthly(amount, freq){
  const a = Number(amount) || 0;
  if (freq === 'yearly') return a/12;
  if (freq === 'weekly') return a * 52/12;
  return a;
}

function formatMoney(n){
  // Use Intl.NumberFormat for Indian Rupee formatting with en-IN locale
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(n) || 0);
}

// Check if an alarm exists for a subscription
async function checkAlarmExists(subId) {
  return new Promise(resolve => {
    chrome.alarms.getAll(alarms => {
      const exists = alarms.some(a => a.name === 'remind_' + subId);
      resolve(exists);
    });
  });
}

async function render(subs) {
  const list = $('subsList');
  list.innerHTML = '';

  if (subs.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.padding = '20px 0';
    emptyMsg.style.color = 'var(--muted)';
    emptyMsg.textContent = 'No subscriptions added yet';
    list.appendChild(emptyMsg);
    return;
  }

  // Get all alarms to check which subscriptions have alarms
  const alarms = await new Promise(resolve => {
    chrome.alarms.getAll(alarms => resolve(alarms));
  });
  
  const notifyDays = await getNotifyDays();

  for (const sub of subs) {
    const li = document.createElement('li');
    li.className = 'subItem';
    
    // Add rarely-used class to highlight potential subscription leaks
    if (sub.usage === 'rarely-used') {
      li.classList.add('rarely-used');
    }

    const info = document.createElement('div');
    info.className = 'subInfo';
    
    // Create name element with alarm indicator
    const nameWrapper = document.createElement('div');
    nameWrapper.style.display = 'flex';
    nameWrapper.style.alignItems = 'center';
    
    const name = document.createElement('span');
    name.style.fontWeight = '500';
    name.textContent = sub.name;
    nameWrapper.appendChild(name);
    
    // Add usage indicator
    const usage = sub.usage || 'frequently-used';
    const usageIndicator = document.createElement('span');
    usageIndicator.className = `usage-indicator usage-${usage}`;
    usageIndicator.textContent = usage === 'frequently-used' ? 'Used' : 'Rarely Used';
    nameWrapper.appendChild(usageIndicator);
    
    // Check if this subscription has an alarm
    const hasAlarm = alarms.some(a => a.name === 'remind_' + sub.id);
    
    if (hasAlarm) {
      const alarmIndicator = document.createElement('span');
      alarmIndicator.className = 'alarmIndicator';
      alarmIndicator.innerHTML = `
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
        </svg>
        Reminder set
      `;
      nameWrapper.appendChild(alarmIndicator);
    }
    
    // Format the meta information
    const meta = document.createElement('div');
    meta.style.fontSize = '12px';
    meta.style.color = 'var(--muted)';
    meta.style.marginTop = '4px';
    
    // Format the frequency display nicely (capitalize first letter)
    const freqDisplay = sub.frequency.charAt(0).toUpperCase() + sub.frequency.slice(1);
    
    // Format the date to be more readable
    const formattedDate = formatDate(sub.nextBilling);
    
    meta.textContent = `${formatMoney(sub.amount)} · ${freqDisplay} · Next: ${formattedDate}`;
    
    // Add reminder info if alarm exists
    if (hasAlarm) {
      const reminderDate = new Date(new Date(sub.nextBilling).getTime() - (notifyDays * 24 * 60 * 60 * 1000));
      const reminderInfo = document.createElement('div');
      reminderInfo.style.fontSize = '11px';
      reminderInfo.style.marginTop = '2px';
      reminderInfo.style.color = '#047857';
      reminderInfo.textContent = `Reminder on: ${formatDate(reminderDate)}`;
      meta.appendChild(reminderInfo);
    }
    
    info.appendChild(nameWrapper);
    info.appendChild(meta);

    // Create action buttons
    const actions = document.createElement('div');
    actions.className = 'subActions';
    
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.title = 'Edit subscription';
    editBtn.onclick = () => populateForm(sub.id);
    
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.title = 'Delete subscription';
    delBtn.onclick = async () => {
      if (confirm(`Are you sure you want to delete "${sub.name}"?`)) {
        await deleteSub(sub.id);
      }
    };
    
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test';
    testBtn.title = 'Test reminder notification';
    testBtn.style.background = '#f59e0b';
    testBtn.style.padding = '6px';
    testBtn.style.fontSize = '12px';
    testBtn.onclick = () => testReminder(sub);
    
    actions.appendChild(editBtn);
    actions.appendChild(testBtn);
    actions.appendChild(delBtn);

    li.appendChild(info);
    li.appendChild(actions);
    list.appendChild(li);
  }
}

async function refreshUI(){
  const subs = await getSubs();
  render(subs);

  // total monthly
  const totalMonthly = subs.reduce((acc, s) => acc + toMonthly(s.amount, s.frequency), 0);
  $('totalMonthly').textContent = formatMoney(totalMonthly);

  // Calculate rarely used subscriptions total
  const rarelyUsed = subs.filter(s => s.usage === 'rarely-used');
  const rarelyUsedTotal = rarelyUsed.reduce((acc, s) => acc + toMonthly(s.amount, s.frequency), 0);
  
  // Add rarely used total below the monthly total if there are any rarely used subscriptions
  if (rarelyUsed.length > 0) {
    const rarelyUsedText = document.querySelector('.summary .total');
    if (rarelyUsedText) {
      const rarelyUsedInfo = document.createElement('div');
      rarelyUsedInfo.style.fontSize = '13px';
      rarelyUsedInfo.style.color = '#b91c1c';
      rarelyUsedInfo.style.marginTop = '8px';
      rarelyUsedInfo.style.fontWeight = '500';
      rarelyUsedInfo.innerHTML = `Potential leaks: ${formatMoney(rarelyUsedTotal)}/month`;
      
      // Insert after the main total
      rarelyUsedText.parentNode.insertBefore(rarelyUsedInfo, rarelyUsedText.nextSibling);
    }
  }

  // upcoming (next 30 days)
  const upcomingList = $('upcomingList');
  upcomingList.innerHTML = '';
  const now = new Date();
  const in30 = new Date(now.getTime() + 30*24*60*60*1000);
  const upcoming = subs
    .map(s => ({...s, next: new Date(s.nextBilling)}))
    .filter(s => s.next >= now && s.next <= in30)
    .sort((a,b)=>a.next-b.next);

  if(upcoming.length===0){
    const li = document.createElement('li'); 
    li.textContent = 'No upcoming renewals in the next 30 days'; 
    li.style.color = 'var(--muted)';
    upcomingList.appendChild(li);
  } else {
    upcoming.forEach(u=>{
      const li = document.createElement('li');
      // Format the date to be more readable
      const dateOptions = { month: 'short', day: 'numeric' };
      const formattedDate = u.next.toLocaleDateString(undefined, dateOptions);
      
      // Add visual indicator for rarely used subscriptions
      const isRarelyUsed = u.usage === 'rarely-used';
      const nameStyle = isRarelyUsed ? 'color: #b91c1c; font-weight: 500;' : 'font-weight: 500;';
      
      li.innerHTML = `<span style="${nameStyle}">${u.name}</span> — ${formatMoney(u.amount)} on <span style="color:var(--accent)">${formattedDate}</span>`;
      upcomingList.appendChild(li);
    });
  }
}

function uuid(){return 'id-'+Math.random().toString(36).slice(2,9)}

function populateForm(id){
  getSubs().then(subs=>{
    const s = subs.find(x=>x.id===id);
    if(!s) return;
    $('editId').value = s.id;
    $('name').value = s.name;
    $('amount').value = s.amount;
    $('frequency').value = s.frequency;
    $('nextBilling').value = s.nextBilling;
    // Handle usage field, defaulting to frequently-used if not present
    $('usage').value = s.usage || 'frequently-used';
  });
}

async function deleteSub(id) {
  try {
    // Delete the subscription from storage
    const subs = await getSubs();
    const filtered = subs.filter(s => s.id !== id);
    await saveSubs(filtered);
    
    // Delete the alarm via the background service worker
    chrome.runtime.sendMessage({
      action: 'deleteAlarm',
      subscriptionId: id
    }, response => {
      if (!response || !response.success) {
        console.error('Failed to delete alarm for subscription:', id);
      }
    });
    
    refreshUI();
    return true;
  } catch (e) {
    console.error('Error deleting subscription:', e);
    return false;
  }
}

async function scheduleReminder(sub) {
  try {
    // Schedule the reminder via the background service worker
    chrome.runtime.sendMessage({
      action: 'createAlarm',
      subscription: sub
    }, response => {
      if (!response || !response.success) {
        console.error('Failed to schedule reminder for:', sub.name);
      }
    });
    return true;
  } catch (e) {
    console.error('Error scheduling reminder:', e);
    return false;
  }
}

// Test reminder (creates a 1-minute alarm)
async function testReminder(sub) {
  try {
    chrome.runtime.sendMessage({
      action: 'testAlarm',
      subscription: sub
    }, response => {
      if (response && response.success) {
        alert(`Test reminder for "${sub.name}" will appear in about 1 minute.`);
      } else {
        alert('Failed to schedule test reminder. Check the console for errors.');
      }
    });
  } catch (e) {
    console.error('Error testing reminder:', e);
    alert('Error testing reminder. Check the console for errors.');
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  // Load notification settings
  const notifyDays = await getNotifyDays();
  $('notifyDays').value = notifyDays;
  $('notifyDaysText').textContent = notifyDays;
  
  // Load subscriptions and render UI
  await refreshUI();

  // Add subscription form submit
  $('subForm').addEventListener('submit', async e => {
    e.preventDefault();
    
    const id = $('editId').value || uuid();
    const sub = {
      id,
      name: $('name').value.trim(),
      amount: Number($('amount').value),
      frequency: $('frequency').value,
      nextBilling: $('nextBilling').value,
      usage: $('usage').value || 'frequently-used'
    };

    // Validate billing date
    if (!sub.nextBilling) {
      alert('Please enter a valid billing date.');
      return;
    }

    // Save to storage
    const subs = await getSubs();
    const exists = subs.find(s => s.id === id);
    if (exists) {
      const idx = subs.findIndex(s => s.id === id);
      subs[idx] = sub;
    } else {
      subs.push(sub);
    }
    await saveSubs(subs);
    
    // Schedule reminder
    await scheduleReminder(sub);
    
    // Clear form and refresh UI
    $('subForm').reset();
    $('editId').value = '';
    refreshUI();
  });

  // Clear button
  $('clearBtn').addEventListener('click', () => { 
    $('subForm').reset();
    $('editId').value = '';
  });
  
  // Test reminder button
  $('testReminderBtn').addEventListener('click', () => {
    const id = $('editId').value;
    
    // If editing an existing subscription, test its reminder
    if (id) {
      getSubs().then(subs => {
        const sub = subs.find(s => s.id === id);
        if (sub) {
          testReminder(sub);
          return;
        }
      });
    }
    
    // Otherwise, create a temporary subscription for testing
    const name = $('name').value.trim();
    if (!name) {
      alert('Please enter a subscription name first.');
      return;
    }
    
    const amount = Number($('amount').value) || 0;
    const frequency = $('frequency').value;
    const nextBilling = $('nextBilling').value;
    
    if (!nextBilling) {
      alert('Please enter a billing date.');
      return;
    }
    
    const testSub = {
      id: 'test-' + Date.now(),
      name,
      amount,
      frequency,
      nextBilling
    };
    
    testReminder(testSub);
  });
  
  // Save settings button
  $('saveSettingsBtn').addEventListener('click', async () => {
    const days = Number($('notifyDays').value);
    if (isNaN(days) || days < 1 || days > 30) {
      alert('Please enter a valid number of days between 1 and 30.');
      return;
    }
    
    const success = await setNotifyDays(days);
    if (success) {
      alert('Notification settings saved! All reminders have been updated.');
    } else {
      alert('Failed to save notification settings. Please try again.');
    }
  });

  // Listen for storage changes to update UI if multiple popups/windows
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes[STORAGE_KEY]) refreshUI();
      
      if (changes[CONFIG_KEY]) {
        // Update notification days display
        const config = changes[CONFIG_KEY].newValue || {};
        const days = config.notifyBeforeDays || DEFAULT_NOTIFY_DAYS;
        $('notifyDays').value = days;
        $('notifyDaysText').textContent = days;
      }
    }
  });
});

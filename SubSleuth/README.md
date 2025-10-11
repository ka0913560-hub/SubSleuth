# SubSleuth — Subscription Manager

SubSleuth helps you track and manage all your subscription expenses in one place, with automated reminders before billing dates and identifies potential subscription leaks.

## Using SubSleuth

1. **Add Subscriptions**: Click the SubSleuth icon, fill out the form with name, amount, frequency, next billing date, and usage frequency
2. **Track Monthly Spending**: View your total monthly cost at the top of the popup
3. **Manage Subscriptions**: Edit or delete subscriptions as needed
4. **Get Reminders**: Receive notifications before your subscriptions renew
5. **Identify Subscription Leaks**: Subscriptions marked as "Rarely Used" are highlighted to help you identify services you're paying for but not using

## Testing Reminders

There are two ways to test notifications:

### Method 1: Quick Test Button
1. Add a subscription or start editing an existing one
2. Click the "Test Reminder" button
3. You'll receive a test notification in about 1 minute

### Method 2: Test an Existing Subscription
1. View your subscription list
2. Click the "Test" button next to any subscription
3. You'll receive a test notification in about 1 minute

## Configuring Reminder Timing
1. Open the "Notification Settings" section at the bottom of the popup
2. Change the number of days before billing to receive notifications (default: 3 days)
3. Click "Save Settings"

## Managing Usage Status

SubSleuth helps you identify potential "subscription leaks" — services you pay for but rarely use:

1. When adding or editing a subscription, select either "Frequently Used" or "Rarely Used" in the Usage dropdown
2. Rarely used subscriptions are highlighted in red in your subscription list
3. A "Potential leaks" summary shows how much you're spending on rarely used services
4. Use this feature to identify subscriptions you might want to cancel or downgrade

## Technical Notes

- All data is stored locally via `chrome.storage.local` and never leaves your browser
- Reminders use `chrome.alarms` and `chrome.notifications` APIs
- Alarms are scheduled at (next billing date - X days) where X is configurable
- Weekly subscriptions are converted to monthly cost using (amount × 52/12)
- Subscription usage status is stored as part of the subscription object



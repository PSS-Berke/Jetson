# Bulk Actions UI Guide

## Visual Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  5 jobs selected    [Clear selection]    [Bulk Actions ▼]      │
└─────────────────────────────────────────────────────────────────┘
                                                    │
                                                    │ Click
                                                    ▼
                                           ┌──────────────────┐
                                           │  Bulk Actions    │
                                           ├──────────────────┤
                                           │ 🔒 Change Status ▼│
                                           │                  │
                                           ├──────────────────┤
                                           │ 🗑️  Delete Selected│
                                           └──────────────────┘
                                                    │
                                    Click "Change Status"
                                                    ▼
                                           ┌──────────────────────────┐
                                           │  Bulk Actions            │
                                           ├──────────────────────────┤
                                           │ 🔒 Change Status ▲       │
                                           │                          │
                                           │  ○ 🔒 Hard Scheduled     │
                                           │  ○ 🔓 Soft Scheduled     │
                                           │                          │
                                           │  [     Confirm     ]     │
                                           │                          │
                                           ├──────────────────────────┤
                                           │ 🗑️  Delete Selected      │
                                           └──────────────────────────┘
```

## Step-by-Step User Flow

### Changing Job Status (Hard/Soft Scheduled)

1. **Select Jobs**
   - Click checkboxes on individual jobs
   - OR click "Select All" checkbox in table header
   - Blue highlight appears on selected rows

2. **Open Bulk Actions**
   - Toolbar appears: "5 jobs selected"
   - Click "Bulk Actions" button (blue button with dropdown icon)

3. **Choose Change Status**
   - Dropdown menu appears
   - Click "Change Status" option
   - Submenu expands showing radio options

4. **Select Status Type**
   - Choose one:
     - ○ Hard Scheduled (Lock) - Sets all weeks as locked
     - ○ Soft Scheduled (Unlock) - Sets all weeks as unlocked
   - Confirm button becomes enabled

5. **Confirm Action**
   - Click "Confirm" button
   - Confirmation dialog appears
   - Click "OK" to proceed

6. **View Results**
   - Success alert shows: "Successfully locked 5 jobs"
   - OR: "Locked 4 of 5 jobs. 1 failed."
   - Selection clears automatically
   - Data refreshes

### Deleting Jobs

1. **Select Jobs**
   - Click checkboxes on jobs to delete

2. **Open Bulk Actions**
   - Click "Bulk Actions" button

3. **Choose Delete**
   - Click "Delete Selected" (red text)
   - Menu closes automatically

4. **Confirm Deletion**
   - Confirmation dialog: "Are you sure you want to delete 5 selected jobs?"
   - Click "OK" to proceed

5. **View Results**
   - Success alert shows result
   - Selection clears
   - Data refreshes

## UI Components

### Bulk Actions Button
```
[Bulk Actions ▼]
```
- **Color**: Blue (#3B82F6)
- **State**: Enabled when jobs selected
- **Icon**: ChevronDown (rotates 180° when menu open)
- **Location**: Right side of toolbar

### Dropdown Menu
```
┌────────────────────────┐
│ 🔒 Change Status    ▼  │  ← Expandable
├────────────────────────┤
│ 🗑️  Delete Selected    │  ← Direct action
└────────────────────────┘
```
- **Width**: 256px (w-64)
- **Position**: Absolute, right-aligned
- **Shadow**: Large shadow-lg
- **Z-index**: 50 (appears above other content)

### Status Submenu
```
┌────────────────────────────┐
│ 🔒 Change Status    ▲      │
│                            │
│  ○ 🔒 Hard Scheduled       │  ← Radio buttons
│  ○ 🔓 Soft Scheduled       │
│                            │
│  [     Confirm     ]       │  ← Disabled until selection
└────────────────────────────┘
```
- **Background**: Gray-50 (#F9FAFB)
- **Padding**: More generous for touch targets
- **Radio buttons**: Native HTML inputs
- **Confirm button**: Disabled state when no selection

## Visual States

### Default State (No Selection)
```
┌─────────────────────────────────────────────────────────────────┐
│                    [No bulk actions shown]                       │
└─────────────────────────────────────────────────────────────────┘
```
- Toolbar hidden
- Checkboxes visible but no highlight

### Active State (Jobs Selected)
```
┌─────────────────────────────────────────────────────────────────┐
│  3 jobs selected    [Clear selection]    [Bulk Actions ▼]      │
└─────────────────────────────────────────────────────────────────┘
```
- Blue background (bg-blue-50)
- Blue border (border-blue-200)
- Selection count displayed
- Bulk Actions button enabled

### Menu Open State
```
┌─────────────────────────────────────────────────────────────────┐
│  3 jobs selected    [Clear selection]    [Bulk Actions ▲]      │
└─────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                           [Dropdown Menu]
```
- ChevronDown rotates 180°
- White dropdown with shadow
- Click outside to close

### Submenu Expanded State
```
[Status options visible with radio buttons]
[Confirm button enabled/disabled based on selection]
```
- ChevronDown rotates on submenu
- Gray background differentiates submenu
- Clear visual hierarchy

## Color Coding

| Element | Color | Purpose |
|---------|-------|---------|
| Toolbar Background | Blue-50 | Selection active |
| Bulk Actions Button | Blue-600 | Primary action |
| Hard Scheduled Icon | Green-600 | Positive/locked |
| Soft Scheduled Icon | Gray-600 | Neutral/unlocked |
| Delete Text | Red-600 | Destructive action |
| Delete Hover | Red-50 | Danger warning |

## Mobile Considerations

On mobile devices (< 768px):
- Toolbar stacks vertically
- Selection count on top
- Bulk Actions button on bottom
- Dropdown menu still appears in same location
- Touch targets are adequately sized (44px minimum)

## Keyboard Interactions

- **Tab**: Navigate through menu items
- **Enter/Space**: Activate buttons
- **Escape**: Close dropdown menu (future enhancement)
- **Arrow keys**: Navigate radio buttons

## Accessibility Features

1. **Visual Feedback**
   - Selected rows: Blue background
   - Hover states on all interactive elements
   - Disabled state clearly indicated

2. **Clear Labels**
   - "Hard Scheduled (Lock)" explicitly states what it does
   - "Soft Scheduled (Unlock)" clear alternative
   - Icons reinforce meaning

3. **Confirmation Steps**
   - Two-step process prevents accidents
   - Browser confirmation dialogs for destructive actions
   - Clear success/failure messaging

4. **Touch-Friendly**
   - Buttons sized for touch (py-2, py-3)
   - Adequate spacing between options
   - No tiny click targets

## Edge Cases Handled

1. **Click Outside**: Menu closes
2. **No Status Selected**: Confirm button disabled
3. **Menu Open + New Selection**: Menu stays open
4. **Menu Open + Clear Selection**: Toolbar disappears, menu closes
5. **Action in Progress**: Button states prevent double-clicks
6. **Partial Failures**: Clear messaging about success/failure counts

## Animation Details

- ChevronDown rotation: `transition-transform`
- Hover states: `transition-colors`
- Menu appearance: Instant (no fade/slide for simplicity)
- Button interactions: Smooth color transitions

## Best Practices for Users

1. **Review Selection**: Always check the count before opening menu
2. **Use Clear Selection**: Easy way to start over
3. **Read Confirmation Dialogs**: Understand what will happen
4. **Check Results**: Review success/failure messages
5. **One Action at a Time**: Complete one bulk action before starting another

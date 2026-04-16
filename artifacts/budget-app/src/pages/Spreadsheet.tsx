import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

const STORAGE_KEY = "budget_spreadsheet_v1";
const DEBOUNCE_MS = 500;

/* ─────────────────────────────────────────────────────────────────────────────
   Full Hebrew translation map — covers toolbar, context-menus, and all dialogs
   ───────────────────────────────────────────────────────────────────────────── */
const HE: Record<string, string> = {
  // ── Toolbar tooltips ──────────────────────────────────────────────────────
  "Toolbar": "סרגל כלים",
  "Undo": "בטל",
  "Redo": "בצע שנית",
  "Clear Format": "נקה עיצוב",
  "Format-Painter": "העתק עיצוב",
  "Paint format": "העתק עיצוב",
  "Format as currency": "פורמט מטבע",
  "Format as percent": "פורמט אחוז",
  "Decrease decimal places": "הפחת ספרות עשרוניות",
  "Increase decimal places": "הוסף ספרות עשרוניות",
  "More formats": "פורמטים נוספים",
  "Border All": "גבולות לכל",
  "Merge All Cell": "מזג את כל התאים",
  "Format": "פורמט",
  "Font": "גופן",
  "Font size": "גודל גופן",
  "Bold (Ctrl+B)": "מודגש (Ctrl+B)",
  "Italic (Ctrl+I)": "נטוי (Ctrl+I)",
  "Strikethrough (Alt+Shift+5)": "קו חוצה",
  "Underline": "קו תחתון",
  "Font color": "צבע טקסט",
  "Left aligned": "יישור שמאל",
  "Horizontal Center": "מרכז אופקי",
  "Right aligned": "יישור ימין",
  "Top aligned": "יישור למעלה",
  "Vertical Center": "מרכז אנכי",
  "Bottom aligned": "יישור למטה",
  "choose color": "בחר צבע",
  "Reset": "אפס",
  "CUSTOM": "מותאם אישית",
  "Alternating colors": "צבעים מתחלפים",
  "Collapse": "כווץ",
  "Fill color": "צבע מילוי",
  "Border": "גבול",
  "Border style": "סגנון גבול",
  "Merge cells": "מזג תאים",
  "Choose merge type": "בחר סוג מיזוג",
  "Horizontal align": "יישור אופקי",
  "Vertical align": "יישור אנכי",
  "Alignment": "יישור",
  "Text wrap": "גלישת טקסט",
  "Text wrap mode": "מצב גלישת טקסט",
  "Text rotate": "סיבוב טקסט",
  "Text rotate mode": "מצב סיבוב טקסט",
  "Freeze": "הקפא",
  "Sort": "מיין",
  "Filter": "סנן",
  "Sort and filter": "מיין וסנן",
  "Find and replace": "חפש והחלף",
  "SUM": "סכום",
  "Auto SUM": "סכום אוטומטי",
  "More functions": "פונקציות נוספות",
  "Conditional format": "עיצוב מותנה",
  "Comment": "הערה",
  "Pivot Table": "טבלת ציר",
  "Chart": "תרשים",
  "Screenshot": "צילום מסך",
  "Split text": "פיצול טקסט",
  "Insert image": "הכנס תמונה",
  "Insert link": "הכנס קישור",
  "Data verification": "אימות נתונים",
  "Protect the sheet": "הגן על הגיליון",
  "More": "עוד",
  "Less": "פחות",
  "Close": "סגור",
  "More features": "תכונות נוספות",
  "More options": "אפשרויות נוספות",
  "Cell format config": "הגדרות עיצוב תא",
  "Print": "הדפס",
  "Clear color": "נקה צבע",
  "No color is selected": "לא נבחר צבע",

  // ── Context menu — cells ──────────────────────────────────────────────────
  "Copy": "העתק",
  "Copy as": "העתק כ...",
  "Paste": "הדבק",
  "Delete selected Row": "מחק שורות נבחרות",
  "Delete selected Column": "מחק עמודות נבחרות",
  "Hide selected Row": "הסתר שורות נבחרות",
  "Show hidden Row": "הצג שורות מוסתרות",
  "Hide selected Column": "הסתר עמודות נבחרות",
  "Show hidden Column": "הצג עמודות מוסתרות",
  "Clear content": "נקה תוכן",
  "Ascending sort": "מיון עולה",
  "Descending sort": "מיון יורד",
  "Create chart": "צור תרשים",
  "Matrix operation": "פעולת מטריצה",
  "Delete cell": "מחק תא",
  "Insert image": "הכנס תמונה",

  // ── Context menu — sheet tab ──────────────────────────────────────────────
  "Delete": "מחק",
  "Rename": "שנה שם",
  "Change color": "שנה צבע",
  "Hide": "הסתר",
  "Unhide": "הצג",
  "Move left": "הזז שמאלה",
  "Move right": "הזז ימינה",
  "Reset color": "אפס צבע",
  "Cancel": "ביטול",
  "Confirm color": "אשר צבע",
  "Focus": "מיקוד",

  // ── Buttons (dialogs) ─────────────────────────────────────────────────────
  "OK": "אישור",
  "Confirm": "אישור",
  "Update": "עדכן",
  "Insert": "הכנס",
  "Previous": "הקודם",
  "Next": "הבא",
  "Apply": "החל",
  "Done": "סיום",

  // ── Find & Replace dialog ─────────────────────────────────────────────────
  "Find": "חפש",
  "Replace": "החלף",
  "Go to": "עבור אל",
  "Location": "מיקום",
  "Formula": "נוסחה",
  "Date": "תאריך",
  "Number": "מספר",
  "String": "טקסט",
  "Error": "שגיאה",
  "Find and Replace": "חפש והחלף",
  "Search": "חיפוש",
  "Replace with": "החלף ב",
  "Case sensitive": "רישיות משמעותית",
  "Entire cell": "תא שלם",
  "Find All": "חפש הכל",
  "Replace All": "החלף הכל",
  "Close": "סגור",
  "Regular Expression": "ביטוי רגולרי",
  "find": "חפש",
  "replace": "החלף",
  "goto": "עבור אל",
  "location": "מיקום",
  "formula": "נוסחה",
  "date": "תאריך",
  "findAndReplace": "חפש והחלף",
  // Find & Replace — actual locale keys rendered in dialog
  "Find Content": "תוכן לחיפוש",
  "Replace Content": "תוכן להחלפה",
  "Whole word": "מילה שלמה",
  "Find next": "חפש הבא",
  "The content was not found": "התוכן לא נמצא",
  "No match found": "לא נמצאה התאמה",
  "There is nothing to replace": "אין מה להחליף",
  "Cell not found": "תא לא נמצא",
  "This operation is not available in this mode": "פעולה זו אינה זמינה במצב זה",
  "Condition": "תנאי",
  "Row span": "מרחב שורות",
  "Column span": "מרחב עמודות",
  "Constant": "קבוע",
  "Logical": "לוגי",
  "Null": "ריק",
  "Sheet": "גיליון",
  "Cell": "תא",
  "Value": "ערך",
  "Please enter the search content": "הכנס תוכן לחיפוש",
  "Please select at least two rows": "בחר לפחות שתי שורות",
  "Please select at least two columns": "בחר לפחות שתי עמודות",

  // ── Filter dialog ─────────────────────────────────────────────────────────
  "create filter": "צור סינון",
  "Filter by color": "סנן לפי צבע",
  "Filter by condition": "סנן לפי תנאי",
  "Filter by values": "סנן לפי ערכים",
  "None": "ללא",
  "Enter filter value": "הכנס ערך סינון",
  "Check all": "בחר הכל",
  "Clear": "נקה",
  "Inverse": "הפוך",
  "filter By Values": "סינון לפי ערכים",
  "Clear filter": "נקה סינון",
  "Is empty": "ריק",
  "Is not empty": "לא ריק",
  "Text contains": "טקסט מכיל",
  "Text does not contain": "טקסט אינו מכיל",
  "Text starts with": "טקסט מתחיל ב",
  "Text ends with": "טקסט מסתיים ב",
  "Text is exactly": "טקסט שווה בדיוק",
  "Date is": "תאריך הוא",
  "Date is before": "תאריך לפני",
  "Date is after": "תאריך אחרי",
  "Greater than": "גדול מ",
  "Greater than or equal to": "גדול מ או שווה",
  "Greater or equal to": "גדול מ או שווה",
  "Less than": "קטן מ",
  "Less than or equal to": "קטן מ או שווה",
  "Is equal to": "שווה ל",
  "Is not equal to": "אינו שווה",
  "Is between": "בין",
  "Is not between": "לא בין",
  "(Null)": "(ריק)",
  "Month": "חודש",
  "Year": "שנה",
  "Filter by cell color": "סנן לפי צבע תא",
  "Filter by font color": "סנן לפי צבע גופן",
  "This column contains only one color": "העמודה מכילה צבע אחד בלבד",
  "Date format": "פורמט תאריך",
  "Big amount of data! please wait": "כמות גדולה של נתונים, אנא המתן",
  "There are merged cells in the filter selection, this operation cannot be performed!": "קיימים תאים ממוזגים בבחירת הסינון",
  "Earlier than": "לפני",
  "No earlier than": "לא לפני",
  "Later than": "אחרי",
  "No later than": "לא אחרי",
  "Equal": "שווה",
  "Not equal to": "לא שווה",
  "More than the": "יותר מ",
  "Not selected": "לא נבחר",
  "Include": "כלול",
  "Exclude": "הוצא",

  // ── Border dialog ─────────────────────────────────────────────────────────
  "Top border": "גבול עליון",
  "Bottom border": "גבול תחתון",
  "Left border": "גבול שמאל",
  "Right border": "גבול ימין",
  "No border": "ללא גבול",
  "All borders": "כל הגבולות",
  "Outside border": "גבול חיצוני",
  "Inside border": "גבול פנימי",
  "Horizontal borders": "גבולות אופקיים",
  "Vertical borders": "גבולות אנכיים",
  "border color": "צבע גבול",
  "border size": "עובי גבול",
  "Slash border": "גבול אלכסוני",
  "default": "ברירת מחדל",
  "border style": "סגנון גבול",

  // ── Merge dialog ──────────────────────────────────────────────────────────
  "Merge all": "מזג הכל",
  "Merge Vertically": "מזג אנכית",
  "Merge Horizontally": "מזג אופקית",
  "Unmerge": "בטל מיזוג",
  "Cannot merge overlapping areas": "אין לאחד אזורים חופפים",
  "Cannot perform this operation on partially merged cells": "לא ניתן לבצע פעולה זו על תאים ממוזגים חלקית",

  // ── Align / Wrap / Rotation ───────────────────────────────────────────────
  "left": "שמאל",
  "center": "מרכז",
  "right": "ימין",
  "top": "למעלה",
  "middle": "אמצע",
  "bottom": "למטה",
  "Overflow": "גלישה",
  "Wrap": "גלישת שורה",
  "Clip": "חיתוך",
  "None": "ללא",

  // ── Format dialog (number/currency/date) ─────────────────────────────────
  "More currency formats": "פורמטי מטבע נוספים",
  "More date and time formats": "פורמטי תאריך ושעה נוספים",
  "More number formats": "פורמטי מספר נוספים",
  "Currency formats": "פורמטי מטבע",
  "Decimal places": "ספרות עשרוניות",
  "Date and time formats": "פורמטי תאריך ושעה",
  "Number formats": "פורמטי מספר",
  "The decimal places must be between 0-9!": "ספרות עשרוניות חייבות להיות בין 0-9",
  "Select": "בחר",
  "format": "פורמט",
  "currency": "מטבע",
  "Automatic": "אוטומטי",

  // ── Alternating Colors dialog ─────────────────────────────────────────────
  "Apply range": "החל על טווח",
  "Select range": "בחר טווח",
  "Header": "כותרת",
  "header": "כותרת",
  "Footer": "כותרת תחתית",
  "footer": "כותרת תחתית",
  "Custom": "מותאם אישית",
  "custom": "מותאם אישית",
  "close": "סגור",
  "Click to select text color": "לחץ לבחירת צבע טקסט",
  "Click to select cell color": "לחץ לבחירת צבע תא",
  "Remove alternating colors": "הסר צבעים מתחלפים",
  "color": "צבע",
  "Current": "נוכחי",
  "Please select the range of alternating colors": "בחר טווח לצבעים מתחלפים",
  "No range is selected": "לא נבחר טווח",
  "Alternating colors already exist and cannot be edited": "צבעים מתחלפים כבר קיימים",

  // ── Data Verification dialog ──────────────────────────────────────────────
  "Data Validation": "אימות נתונים",
  "Criteria": "קריטריון",
  "Add": "הוסף",
  "Remove rule": "מחק כלל",
  "Delete verification": "מחק אימות",
  "Invalid data": "נתון לא חוקי",
  "Show warning": "הצג אזהרה",
  "Reject input": "דחה קלט",
  "On invalid data": "בנתון לא חוקי",
  "Appearance": "מראה",
  "Show validation help text": "הצג טקסט עזרה",
  "Hint title": "כותרת רמז",
  "Hint message": "הודעת רמז",
  "Enter an item per line": "הזן פריט בכל שורה",
  "Use range": "השתמש בטווח",
  "select range": "בחר טווח",
  "Equal to": "שווה ל",
  "Number": "מספר",
  "Text": "טקסט",
  "Checkbox": "תיבת סימון",
  "Drop-down list": "רשימה נפתחת",
  "drop-down list": "רשימה נפתחת",
  "Validity": "תקפות",
  "Verification condition": "תנאי אימות",
  "Effectiveness": "אפקטיביות",
  "Allow multiple selection": "אפשר בחירה מרובה",
  "Checkbox content cannot be empty": "תוכן תיבת הסימון לא יכול להיות ריק",
  "Numeric value, such as 10": "ערך מספרי, לדוגמה 10",
  "Number-decimal": "עשרוני",
  "Number-integer": "שלם",
  "Date 2 cannot be less than date 1": "תאריך 2 לא יכול להיות קודם לתאריך 1",
  "The value 2 cannot be less than the value 1": "הערך 2 לא יכול להיות קטן מהערך 1",
  "The value entered is not a date type": "הערך שהוזן אינו מסוג תאריך",
  "The value entered is not a numeric type": "הערך שהוזן אינו מסוג מספר",
  "Identification number": "מספר מזהה",

  // ── Sheet Protection dialog ───────────────────────────────────────────────
  "Protect Sheet": "הגן על גיליון",
  "Password (optional)": "סיסמה (אופציונלי)",
  "Allow all users to:": "אפשר לכל המשתמשים:",
  "Select locked cells": "בחר תאים נעולים",
  "Select unlocked cells": "בחר תאים לא נעולים",
  "Format cells": "עצב תאים",
  "Format columns": "עצב עמודות",
  "Format rows": "עצב שורות",
  "Insert columns": "הכנס עמודות",
  "Insert rows": "הכנס שורות",
  "Insert links": "הכנס קישורים",
  "Delete columns": "מחק עמודות",
  "Delete rows": "מחק שורות",
  "Sort": "מיין",
  "Use AutoFilter": "השתמש בסינון אוטומטי",
  "Use PivotTable reports": "השתמש בדוחות Pivot",
  "Edit objects": "ערוך אובייקטים",
  "Edit scenarios": "ערוך תרחישים",
  "Allow users of range to:": "אפשר למשתמשי הטווח:",
  "New...": "חדש...",
  "Title": "כותרת",
  "Reference": "הפניה",
  "Click to select a cell range": "לחץ לבחירת טווח תאים",
  "Cell range": "טווח תאים",
  "Password": "סיסמה",
  "Prompt": "רמז",
  "Prompt when a password is set (optional)": "רמז עם הגדרת סיסמה (אופציונלי)",
  "Input range name": "הכנס שם טווח",
  "Double click to edit": "לחץ פעמיים לעריכה",
  "Has password": "בעל סיסמה",
  "Title is null": "הכותרת ריקה",
  "Reference is null": "ההפניה ריקה",
  "Reference is error": "שגיאה בהפניה",
  "Password validation": "אימות סיסמה",
  "Need to enter a password to unlock the protection of the worksheet": "הכנס סיסמה לביטול הגנת הגיליון",
  "Enter a password": "הכנס סיסמה",
  "Password is required!": "סיסמה חובה!",
  "Incorrect password, please try again!": "סיסמה שגויה, נסה שנית!",
  "Unlock Succeed!": "הגנה בוטלה בהצלחה!",
  "The cell is being password protected.": "התא מוגן בסיסמה.",

  // ── Cell Format dialog ────────────────────────────────────────────────────
  "Format cells": "עצב תאים",
  "Protection": "הגנה",
  "Locked": "נעול",
  "Hidden": "מוסתר",
  "To lock cells or hide formulas, protect the worksheet. On the toolbar, Click Protect Sheet Button": "כדי לנעול תאים, הגן על הגיליון",
  "Partial checked": "מסומן חלקית",
  "All checked": "הכל מסומן",
  "Selection is required!": "נא לבחור תחילה!",
  "error, Data is none!": "שגיאה, אין נתונים!",

  // ── Print dialog ──────────────────────────────────────────────────────────
  "Normal": "רגיל",
  "Page Layout": "פריסת עמוד",
  "Page break preview": "תצוגה מקדימה",
  "Print (Ctrl+P)": "הדפס (Ctrl+P)",
  "Print areas": "אזורי הדפסה",
  "Print title rows": "שורות כותרת להדפסה",
  "Print title columns": "עמודות כותרת להדפסה",

  // ── Screenshot dialog ─────────────────────────────────────────────────────
  "Please select the scope of the screenshot": "בחר את אזור צילום המסך",
  "Warning！": "אזהרה!",
  "This operation cannot be performed on merged cells": "לא ניתן לבצע על תאים ממוזגים",
  "This operation cannot be performed on multiple selection regions": "לא ניתן לבצע על ריבוי בחירות",
  "Successful": "הצליח",
  "Close": "סגור",
  "Copy to clipboard": "העתק ללוח",
  "Download": "הורד",

  // ── Insert Link dialog ────────────────────────────────────────────────────
  "Display text": "טקסט לתצוגה",
  "Link type": "סוג קישור",
  "Link address": "כתובת קישור",
  "Worksheet": "גיליון",
  "Cell range": "טווח תאים",
  "Tooltip": "הסבר",
  "Select cell range": "בחר טווח תאים",
  "Please enter the web link address": "הכנס כתובת אתר",
  "Please enter the cell to be quoted, example A1": "הכנס תא להפניה, לדוגמה A1",
  "Please enter the prompt content": "הכנס תוכן רמז",
  "Please enter a valid link": "הכנס קישור חוקי",
  "Open link": "פתח קישור",

  // ── Info / bottom bar ─────────────────────────────────────────────────────
  "Loading...": "טוען...",
  "New sheet": "גיליון חדש",
  "Untitled spreadsheet": "גיליון ללא שם",
  "Zoom in": "הגדל תצוגה",
  "Zoom out": "הקטן תצוגה",
  "Dropdown": "רשימה נפתחת",
  "Sheet options": "אפשרויות גיליון",
  "Exit": "יציאה",
  "Back to the top": "חזור לראש",
  "more rows at bottom": "שורות נוספות בתחתית",
  "waiting for update": "ממתין לעדכון",

  // ── Conditional Format dialog ─────────────────────────────────────────────
  "Conditional Format": "עיצוב מותנה",
  "Add rule": "הוסף כלל",
  "Manage rules": "נהל כללים",
  "Format cells if...": "עצב תאים אם...",
  "Formatting style": "סגנון עיצוב",
  "Preview": "תצוגה מקדימה",
  "Done": "סיום",
  "Cancel": "ביטול",
};

// Placeholder translations (for input fields)
const HE_PLACEHOLDER: Record<string, string> = {
  "Enter filter value": "הכנס ערך סינון",
  "Value for formula": "ערך לנוסחה",
  "Please enter the web link address": "הכנס כתובת אתר",
  "Please enter the cell to be quoted, example A1": "לדוגמה A1",
  "Please enter the prompt content": "הכנס תוכן",
  "Select cells using the cursor or enter directly": "בחר תאים או הכנס ישירות",
  "Cell range": "טווח תאים",
  "Input range name": "שם טווח",
  "Enter an item per line": "פריט בכל שורה",
};

const translated = new WeakSet<Element>();

/** Translate dynamic strings that contain numbers (e.g. "Insert 1 Row Above") */
function translateDynamic(raw: string): string {
  if (HE[raw]) return HE[raw];
  // Insert N Row/Column patterns — use \s* to handle "Insert1Row Above" (no spaces)
  const rowDir: Record<string, string> = { above: "מעל", below: "מתחת" };
  const colDir: Record<string, string> = { left: "משמאל", right: "מימין" };
  let m = raw.match(/^Insert\s*(\d+)\s*Rows?\s*(Above|Below)$/i);
  if (m) {
    const dir = rowDir[m[2].toLowerCase()] ?? m[2];
    return parseInt(m[1]) === 1 ? `הוסף שורה ${dir}` : `הוסף ${m[1]} שורות ${dir}`;
  }
  m = raw.match(/^Insert\s*(\d+)\s*Col(?:umns?)?\s*(Left|Right)$/i);
  if (m) {
    const dir = colDir[m[2].toLowerCase()] ?? m[2];
    return parseInt(m[1]) === 1 ? `הוסף עמודה ${dir}` : `הוסף ${m[1]} עמודות ${dir}`;
  }
  // Delete N Row/Column patterns
  m = raw.match(/^Delete\s*(\d+)\s*Rows?$/i);
  if (m) return parseInt(m[1]) === 1 ? "מחק שורה" : `מחק ${m[1]} שורות`;
  m = raw.match(/^Delete\s*(\d+)\s*Col(?:umns?)?$/i);
  if (m) return parseInt(m[1]) === 1 ? "מחק עמודה" : `מחק ${m[1]} עמודות`;
  // Hide N Row/Column
  m = raw.match(/^Hide\s*(\d+)\s*Rows?$/i);
  if (m) return parseInt(m[1]) === 1 ? "הסתר שורה" : `הסתר ${m[1]} שורות`;
  m = raw.match(/^Hide\s*(\d+)\s*Col(?:umns?)?$/i);
  if (m) return parseInt(m[1]) === 1 ? "הסתר עמודה" : `הסתר ${m[1]} עמודות`;
  // Found N items
  m = raw.match(/^(\d+)\s*items?\s*found$/i);
  if (m) return `נמצאו ${m[1]} פריטים`;
  return "";
}

/* ─────────────────────────────────────────────────────────────────────────────
   Core translation engine
   ───────────────────────────────────────────────────────────────────────────── */
function translateNode(root: Element) {
  // 1. Toolbar tooltip divs (always in DOM, shown on hover via CSS)
  root.querySelectorAll<HTMLElement>(".fortune-tooltip").forEach((el) => {
    if (translated.has(el)) return;
    const t = el.textContent?.trim() ?? "";
    if (HE[t]) { el.textContent = HE[t]; translated.add(el); }
  });

  // 2. data-tips attribute (toolbar buttons)
  root.querySelectorAll<HTMLElement>("[data-tips]").forEach((el) => {
    const t = el.getAttribute("data-tips") ?? "";
    if (HE[t]) el.setAttribute("data-tips", HE[t]);
  });

  // 3. aria-label attribute
  root.querySelectorAll<HTMLElement>("[aria-label]").forEach((el) => {
    const raw = el.getAttribute("aria-label") ?? "";
    if (HE[raw]) { el.setAttribute("aria-label", HE[raw]); return; }
    // Patterns like "Font size: 10" or "Font: Arial"
    const colon = raw.indexOf(":");
    if (colon > 0) {
      const key = raw.slice(0, colon).trim();
      if (HE[key]) el.setAttribute("aria-label", HE[key] + raw.slice(colon));
    }
  });

  // 4. title attribute
  root.querySelectorAll<HTMLElement>("[title]").forEach((el) => {
    const t = el.getAttribute("title") ?? "";
    if (HE[t]) el.setAttribute("title", HE[t]);
  });

  // 5. placeholder attribute (input fields)
  root.querySelectorAll<HTMLInputElement>("input[placeholder], textarea[placeholder]").forEach((el) => {
    const t = el.getAttribute("placeholder") ?? "";
    if (HE_PLACEHOLDER[t]) el.setAttribute("placeholder", HE_PLACEHOLDER[t]);
    else if (HE[t]) el.setAttribute("placeholder", HE[t]);
  });

  // 6. Cell right-click context menu items (including dynamic "Insert N Row Above")
  root.querySelectorAll<HTMLElement>(".luckysheet-cols-menuitem-content").forEach((el) => {
    if (translated.has(el)) return;
    // First try full textContent
    const raw = el.textContent?.trim() ?? "";
    let he = translateDynamic(raw);
    // Fallback: reconstruct from child nodes with spaces (handles "Insert"+"1"+"Row Above" split)
    if (!he && el.childNodes.length > 1) {
      const parts = Array.from(el.childNodes)
        .map((n) => n.textContent?.trim() ?? "")
        .filter(Boolean);
      he = translateDynamic(parts.join(" "));
    }
    if (he) { el.textContent = he; translated.add(el); }
  });

  // 7. Sheet-tab context menu items
  root.querySelectorAll<HTMLElement>(".fortune-sheet-list-item").forEach((el) => {
    if (translated.has(el)) return;
    const raw = el.textContent?.trim() ?? "";
    const he = translateDynamic(raw);
    if (he) { replaceFirstText(el, he); translated.add(el); }
  });

  // 8. All dialog/modal containers — translate every visible text node & button
  const dialogSelectors = [
    ".fortune-dialog",
    ".luckysheet-modal-dialog",
    ".fortune-search-replace",
    ".fortune-data-verification",
    ".fortune-link-modify-modal",
    ".luckysheet-filter-options",
    ".fortune-border-select-menu",
    ".fortune-toolbar-combo-popup",
    ".condition-format-sub-menu",
    "[class*='fortune-alternating']",
    "[class*='protection']",
    "[class*='sheet-protection']",
  ].join(", ");

  root.querySelectorAll<HTMLElement>(dialogSelectors).forEach((dialog) => {
    translateDialogContent(dialog);
  });
}

/** Deeply translate all text nodes and inputs inside a dialog */
function translateDialogContent(container: HTMLElement) {
  // Translate all leaf text nodes
  walkTextNodes(container, (node) => {
    const raw = node.textContent?.trim() ?? "";
    const he = translateDynamic(raw);
    if (raw && he && node.textContent !== he) {
      node.textContent = he;
    }
  });

  // Translate buttons that may have been missed
  container.querySelectorAll<HTMLButtonElement>("button, [role='button']").forEach((btn) => {
    if (btn.querySelector("svg, img")) return;
    const raw = btn.textContent?.trim() ?? "";
    const he = translateDynamic(raw);
    if (he) btn.textContent = he;
  });

  // Translate input placeholders
  container.querySelectorAll<HTMLInputElement>("input[placeholder], textarea[placeholder]").forEach((el) => {
    const t = el.getAttribute("placeholder") ?? "";
    if (HE_PLACEHOLDER[t]) el.setAttribute("placeholder", HE_PLACEHOLDER[t]);
    else if (HE[t]) el.setAttribute("placeholder", HE[t]);
  });

  // Translate labels and spans
  container.querySelectorAll<HTMLElement>("label, span, p, h1, h2, h3, h4, div.title, div.label").forEach((el) => {
    if (el.children.length > 0) return;
    const raw = el.textContent?.trim() ?? "";
    const he = translateDynamic(raw);
    if (raw && he && el.textContent !== he) {
      el.textContent = he;
    }
  });
}

/** Walk all text nodes inside an element */
function walkTextNodes(el: Element, cb: (node: Text) => void) {
  const iter = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = iter.nextNode() as Text | null)) {
    cb(node);
  }
}

function replaceFirstText(el: HTMLElement, translated: string) {
  if (el.children.length === 0) { el.textContent = translated; return; }
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent?.trim() ?? "")) {
      node.textContent = translated;
      return;
    }
  }
}

const DEFAULT_DATA = [{ name: "גליון 1", celldata: [], config: {}, index: "0" }];

function getLocalData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

/**
 * Fortune Sheet's onChange returns sheets with a dense `data` 2D array.
 * The Workbook component expects sheets with a sparse `celldata` array.
 * This converts between the two so we always load the right format.
 */
function normalizeSheetsForLoad(sheets: unknown[]): unknown[] {
  if (!Array.isArray(sheets)) return sheets;
  return sheets.map((sheet: any) => {
    if (!sheet) return sheet;
    // Already has celldata — nothing to do
    if (Array.isArray(sheet.celldata) && sheet.celldata.length > 0) return sheet;
    // Has dense `data` array — convert to sparse celldata
    if (Array.isArray(sheet.data)) {
      const celldata: { r: number; c: number; v: unknown }[] = [];
      for (let r = 0; r < sheet.data.length; r++) {
        const row = sheet.data[r];
        if (!Array.isArray(row)) continue;
        for (let c = 0; c < row.length; c++) {
          if (row[c] !== null && row[c] !== undefined) {
            celldata.push({ r, c, v: row[c] });
          }
        }
      }
      const { data: _data, ...rest } = sheet;
      return { ...rest, celldata };
    }
    return sheet;
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────────────────────── */
type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function Spreadsheet() {
  const [data, setData] = useState<unknown[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // latestDataRef: always holds the most recent sheet data for beforeunload
  const latestDataRef = useRef<unknown[] | null>(null);
  // readyToSaveRef: false until Fortune Sheet finishes its init onChange calls
  const readyToSaveRef = useRef(false);

  // Build the API base URL once (same logic as apiFetch)
  const apiBase = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

  // Load from server on mount — do NOT render Workbook until data arrives
  useEffect(() => {
    apiFetch("/spreadsheet")
      .then((res) => {
        if (res?.data) {
          const normalized = normalizeSheetsForLoad(res.data);
          setData(normalized);
          latestDataRef.current = normalized;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch {}
        } else {
          const fallback = normalizeSheetsForLoad(getLocalData() ?? DEFAULT_DATA);
          setData(fallback);
          latestDataRef.current = fallback;
        }
      })
      .catch(() => {
        const fallback = normalizeSheetsForLoad(getLocalData() ?? DEFAULT_DATA);
        setData(fallback);
        latestDataRef.current = fallback;
      })
      .finally(() => setLoaded(true));
  }, []);

  // After Workbook mounts (loaded=true), allow saves after a short delay
  // so Fortune Sheet's own init onChange calls don't trigger a spurious save
  useEffect(() => {
    if (!loaded) return;
    readyToSaveRef.current = false;
    const t = setTimeout(() => { readyToSaveRef.current = true; }, 1500);
    return () => clearTimeout(t);
  }, [loaded]);

  // Before page unloads: flush any pending save immediately using fetch+keepalive
  // (sendBeacon+application/json requires a CORS preflight which may not complete on unload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!readyToSaveRef.current || !latestDataRef.current) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      fetch(`${apiBase}/spreadsheet`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: latestDataRef.current }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [apiBase]);

  // Hebrew translation observer — runs after Workbook mounts
  useEffect(() => {
    if (!loaded) return;
    const container = containerRef.current;
    if (!container) return;

    const run = () => {
      translateNode(container);
      translateNode(document.body);
    };

    run();
    const t1 = setTimeout(run, 300);
    const t2 = setTimeout(run, 800);
    const t3 = setTimeout(run, 1500);

    const observer = new MutationObserver(run);
    observer.observe(container, {
      childList: true, subtree: true,
      attributes: true,
      attributeFilter: ["title", "data-tips", "aria-label", "placeholder"],
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); observer.disconnect(); };
  }, [loaded]);

  const handleChange = useCallback((d: unknown[]) => {
    // During Fortune Sheet's init phase, ignore onChange calls —
    // they may contain empty/partial data that would overwrite the loaded server data.
    if (!readyToSaveRef.current) return;

    setData(d);
    latestDataRef.current = d;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {}

    // Show "pending" status immediately on change
    setSaveStatus("saving");
    if (savedBadgeTimerRef.current) clearTimeout(savedBadgeTimerRef.current);

    // Debounced save to server
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      apiFetch("/spreadsheet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: d }),
      })
        .then(() => {
          setSaveStatus("saved");
          savedBadgeTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
        })
        .catch(() => {
          setSaveStatus("error");
        });
    }, DEBOUNCE_MS);
  }, []);

  // Show spinner until server responds
  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#666" }}>
        טוען גליון...
      </div>
    );
  }

  const statusLabel =
    saveStatus === "saving" ? "שומר..." :
    saveStatus === "saved"  ? "נשמר ✓" :
    saveStatus === "error"  ? "שגיאת שמירה ✕" :
    null;

  const statusColor =
    saveStatus === "saving" ? "#6b7280" :
    saveStatus === "saved"  ? "#16a34a" :
    saveStatus === "error"  ? "#dc2626" :
    "transparent";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Save status badge */}
      {statusLabel && (
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 100,
          background: "white", border: `1px solid ${statusColor}`,
          color: statusColor, borderRadius: 8, padding: "2px 10px",
          fontSize: 12, fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          direction: "rtl",
        }}>
          {statusLabel}
        </div>
      )}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        <Workbook
          data={data!}
          onChange={handleChange}
          showToolbar
          showFormulaBar
          showSheetTabs
          lang="en"
        />
      </div>
    </div>
  );
}

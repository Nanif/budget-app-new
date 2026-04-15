import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "budget_spreadsheet_v1";

const HE: Record<string, string> = {
  // Toolbar
  "Undo": "בטל",
  "Redo": "בצע שנית",
  "Clear Format": "נקה עיצוב",
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
  "OK": "אישור",
  "Cancel": "ביטול",
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
  "Cell format config": "הגדרות פורמט תא",
  "Print": "הדפס",
  // Context menu
  "Copy": "העתק",
  "Cut": "גזור",
  "Paste": "הדבק",
  "Paste Special": "הדבקה מיוחדת",
  "Insert Row": "הכנס שורה",
  "Insert Column": "הכנס עמודה",
  "Delete Row": "מחק שורה",
  "Delete Column": "מחק עמודה",
  "Delete Cell": "מחק תא",
  "Hide Row": "הסתר שורה",
  "Hide Column": "הסתר עמודה",
  "Show Row": "הצג שורה",
  "Show Column": "הצג עמודה",
  "Set Row Height": "הגדר גובה שורה",
  "Set Column Width": "הגדר רוחב עמודה",
  "Clear Content": "נקה תוכן",
  "Insert Comment": "הכנס הערה",
  "Edit Comment": "ערוך הערה",
  "Delete Comment": "מחק הערה",
  "Format Cells": "עצב תאים",
  "Freeze Row": "הקפא שורה",
  "Freeze Column": "הקפא עמודה",
  "Unfreeze": "בטל הקפאה",
  "Add Sheet": "הוסף גיליון",
  "Delete Sheet": "מחק גיליון",
  "Rename Sheet": "שנה שם גיליון",
  "Move Sheet": "הזז גיליון",
  "Copy Sheet": "העתק גיליון",
  // Dialogs
  "Loading...": "טוען...",
  "New sheet": "גיליון חדש",
  "Delete": "מחק",
  "Insert": "הכנס",
  "Update": "עדכן",
  "Previous": "הקודם",
  "Next": "הבא",
  "Find": "חפש",
  "Replace": "החלף",
  "Find and Replace": "חפש והחלף",
  "Untitled spreadsheet": "גיליון ללא שם",
  "Rename": "שנה שם",
};

function applyHebrew(root: Element) {
  // Translate title attributes
  root.querySelectorAll("[title]").forEach((el) => {
    const t = el.getAttribute("title") || "";
    if (HE[t]) el.setAttribute("title", HE[t]);
  });
  // Translate visible text in menus / dialogs (not in cells)
  root.querySelectorAll(
    ".fortune-context-menu li, .fortune-modal button, .fortune-modal label, " +
    ".fortune-toolbar-menu li, .fortune-dropdown-item, [class*='menu-item'], " +
    "[class*='context-menu'] li, [class*='dropdown'] li"
  ).forEach((el) => {
    if (el.children.length === 0) {
      const t = el.textContent?.trim() || "";
      if (HE[t]) el.textContent = HE[t];
    }
  });
  // Translate button text in dialogs
  root.querySelectorAll("button").forEach((el) => {
    const t = el.textContent?.trim() || "";
    if (HE[t] && !el.querySelector("svg, img")) el.textContent = HE[t];
  });
}

function getInitialData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [{ name: "גליון 1", celldata: [], config: {}, index: "0" }];
}

export default function Spreadsheet() {
  const [data, setData] = useState(getInitialData);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial pass
    applyHebrew(container);

    // Watch for DOM changes (menus opening, dialogs, etc.)
    const observer = new MutationObserver(() => {
      applyHebrew(container);
      // Also translate anything added to document body (portals)
      applyHebrew(document.body);
    });
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["title"] });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const handleChange = useCallback((d: any[]) => {
    setData(d);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {}
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <Workbook
        data={data}
        onChange={handleChange}
        showToolbar={true}
        showFormulaBar={true}
        showSheetTabs={true}
        lang="en"
      />
    </div>
  );
}

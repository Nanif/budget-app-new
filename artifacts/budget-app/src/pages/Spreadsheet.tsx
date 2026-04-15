import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "budget_spreadsheet_v1";

// Exact English strings that appear as text content in FortuneSheet's DOM
const HE: Record<string, string> = {
  // === Toolbar tooltips (title attribute) ===
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

  // === Cell right-click context menu (luckysheet-cols-menuitem-content) ===
  "Copy": "העתק",
  "Copy as": "העתק כ...",
  "Paste": "הדבק",
  // Concatenated: rightclick.deleteSelected + rightclick.row
  "Delete selected Row": "מחק שורות נבחרות",
  // Concatenated: rightclick.deleteSelected + rightclick.column
  "Delete selected Column": "מחק עמודות נבחרות",
  // Concatenated: rightclick.hideSelected + rightclick.row
  "Hide selected Row": "הסתר שורות נבחרות",
  // Concatenated: rightclick.showHide + rightclick.row
  "Show hidden Row": "הצג שורות מוסתרות",
  // Concatenated: rightclick.hideSelected + rightclick.column
  "Hide selected Column": "הסתר עמודות נבחרות",
  // Concatenated: rightclick.showHide + rightclick.column
  "Show hidden Column": "הצג עמודות מוסתרות",
  "Clear content": "נקה תוכן",
  "Ascending sort": "מיון עולה",
  "Descending sort": "מיון יורד",
  "Create chart": "צור תרשים",
  "Matrix operation": "פעולת מטריצה",
  "Delete cell": "מחק תא",

  // === Sheet tab right-click (sheetconfig locale) ===
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

  // === Dialog buttons ===
  "OK": "אישור",
  "Update": "עדכן",
  "Insert": "הכנס",
  "Previous": "הקודם",
  "Next": "הבא",
  "Find": "חפש",
  "Replace": "החלף",

  // === Sheet / info ===
  "Loading...": "טוען...",
  "New sheet": "גיליון חדש",
  "Untitled spreadsheet": "גיליון ללא שם",
};

function translateNode(root: Element) {
  // 1. Translate all title/aria-label attributes (toolbar tooltips)
  root.querySelectorAll<HTMLElement>("[title]").forEach((el) => {
    const t = el.getAttribute("title")!;
    if (HE[t]) el.setAttribute("title", HE[t]);
  });

  // 2. Translate text inside cell right-click menu items
  //    Each item wraps content in .luckysheet-cols-menuitem-content
  root.querySelectorAll<HTMLElement>(".luckysheet-cols-menuitem-content").forEach((el) => {
    const raw = el.textContent?.trim() ?? "";
    if (HE[raw]) {
      // Replace only the text nodes, leave any child elements (icons, inputs) intact
      replaceTextNodes(el, HE[raw]);
    }
  });

  // 3. Translate sheet-tab context menu items
  root.querySelectorAll<HTMLElement>(".fortune-sheet-list-item").forEach((el) => {
    const raw = el.textContent?.trim() ?? "";
    if (HE[raw]) replaceTextNodes(el, HE[raw]);
  });

  // 4. Translate generic buttons and labels in dialogs
  root.querySelectorAll<HTMLButtonElement>(
    ".fortune-dialog button, .luckysheet-modal-dialog button"
  ).forEach((btn) => {
    if (!btn.querySelector("svg, img")) {
      const raw = btn.textContent?.trim() ?? "";
      if (HE[raw]) btn.textContent = HE[raw];
    }
  });
}

function replaceTextNodes(el: HTMLElement, translated: string) {
  // If the element has no children (pure text node) just set textContent
  if (el.children.length === 0) {
    el.textContent = translated;
    return;
  }
  // Otherwise replace text nodes only (preserve sub-elements like <input>, <span>)
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent?.trim() ?? "")) {
      node.textContent = translated;
      break; // only replace the first meaningful text node
    }
  }
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

    translateNode(container);
    translateNode(document.body);

    const observer = new MutationObserver(() => {
      translateNode(container);
      translateNode(document.body);
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title"],
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  const handleChange = useCallback((d: unknown[]) => {
    setData(d as ReturnType<typeof getInitialData>);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {}
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <Workbook
        data={data}
        onChange={handleChange}
        showToolbar
        showFormulaBar
        showSheetTabs
        lang="en"
      />
    </div>
  );
}

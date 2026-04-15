import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "budget_spreadsheet_v1";

const HE: Record<string, string> = {
  // ── Toolbar tooltips (fortune-tooltip div + data-tips + aria-label) ──
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

  // ── Cell right-click context menu ──
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

  // ── Sheet-tab right-click menu ──
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

  // ── Dialog buttons ──
  "OK": "אישור",
  "Update": "עדכן",
  "Insert": "הכנס",
  "Previous": "הקודם",
  "Next": "הבא",
  "Find": "חפש",
  "Replace": "החלף",
  "Loading...": "טוען...",
  "New sheet": "גיליון חדש",
  "Untitled spreadsheet": "גיליון ללא שם",

  // ── Bottom-bar / zoom ──
  "Zoom in": "הגדל תצוגה",
  "Zoom out": "הקטן תצוגה",
  "Dropdown": "רשימה נפתחת",
  "Sheet options": "אפשרויות גיליון",
};

// Partial-match map for aria-label patterns like "Font size: 10"
const HE_PREFIX: Record<string, string> = {
  "Font size": "גודל גופן",
  "Font": "גופן",
  "Format": "פורמט",
  "Dropdown": "רשימה נפתחת",
};

const already = new WeakSet<Element>();

function translateNode(root: Element) {
  // 1. ── Toolbar tooltip divs (.fortune-tooltip) ──────────────────────────
  root.querySelectorAll<HTMLElement>(".fortune-tooltip").forEach((el) => {
    if (already.has(el)) return;
    const t = el.textContent?.trim() ?? "";
    if (HE[t]) {
      el.textContent = HE[t];
      already.add(el);
    }
  });

  // 2. ── data-tips attribute ────────────────────────────────────────────────
  root.querySelectorAll<HTMLElement>("[data-tips]").forEach((el) => {
    const t = el.getAttribute("data-tips") ?? "";
    if (HE[t] && el.getAttribute("data-tips") !== HE[t]) {
      el.setAttribute("data-tips", HE[t]);
    }
  });

  // 3. ── aria-label attribute ───────────────────────────────────────────────
  root.querySelectorAll<HTMLElement>("[aria-label]").forEach((el) => {
    const raw = el.getAttribute("aria-label") ?? "";
    if (HE[raw]) {
      el.setAttribute("aria-label", HE[raw]);
      return;
    }
    // Handle "Font size: 10" style labels
    for (const [en, he] of Object.entries(HE_PREFIX)) {
      if (raw.startsWith(en + ":") || raw.startsWith(en + " ")) {
        el.setAttribute("aria-label", raw.replace(en, he));
        break;
      }
    }
  });

  // 4. ── title attribute ────────────────────────────────────────────────────
  root.querySelectorAll<HTMLElement>("[title]").forEach((el) => {
    const t = el.getAttribute("title") ?? "";
    if (HE[t] && el.getAttribute("title") !== HE[t]) {
      el.setAttribute("title", HE[t]);
    }
  });

  // 5. ── Cell right-click context menu items ───────────────────────────────
  root.querySelectorAll<HTMLElement>(".luckysheet-cols-menuitem-content").forEach((el) => {
    if (already.has(el)) return;
    const raw = el.textContent?.trim() ?? "";
    if (HE[raw]) {
      replaceFirstTextNode(el, HE[raw]);
      already.add(el);
    }
  });

  // 6. ── Sheet-tab context menu items ──────────────────────────────────────
  root.querySelectorAll<HTMLElement>(".fortune-sheet-list-item").forEach((el) => {
    if (already.has(el)) return;
    const raw = el.textContent?.trim() ?? "";
    if (HE[raw]) {
      replaceFirstTextNode(el, HE[raw]);
      already.add(el);
    }
  });

  // 7. ── Dialog / modal buttons ─────────────────────────────────────────────
  root.querySelectorAll<HTMLButtonElement>(
    ".fortune-dialog button, .luckysheet-modal-dialog button, " +
    ".fortune-dialog-box-button-container button"
  ).forEach((btn) => {
    if (already.has(btn) || btn.querySelector("svg, img")) return;
    const raw = btn.textContent?.trim() ?? "";
    if (HE[raw]) {
      btn.textContent = HE[raw];
      already.add(btn);
    }
  });
}

function replaceFirstTextNode(el: HTMLElement, translated: string) {
  if (el.children.length === 0) {
    el.textContent = translated;
    return;
  }
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent?.trim() ?? "")) {
      node.textContent = translated;
      return;
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

    // Give FortuneSheet a tick to finish its internal render
    const runTranslate = () => {
      translateNode(container);
      translateNode(document.body);
    };

    runTranslate();
    // Also run after a short delay in case FortuneSheet renders async
    const t1 = setTimeout(runTranslate, 300);
    const t2 = setTimeout(runTranslate, 800);

    const observer = new MutationObserver(runTranslate);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title", "data-tips", "aria-label"],
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
    };
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

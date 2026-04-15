import { Workbook } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { useCallback, useState } from "react";

const STORAGE_KEY = "budget_spreadsheet_v1";

function getInitialData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [
    {
      name: "גליון 1",
      celldata: [],
      config: {},
      index: "0",
    },
  ];
}

export default function Spreadsheet() {
  const [data, setData] = useState(getInitialData);

  const handleChange = useCallback((d: any[]) => {
    setData(d);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {}
  }, []);

  return (
    <div
      style={{ width: "100%", height: "calc(100vh - 110px)" }}
      className="-mx-4 md:-mx-8 lg:-mx-10 -mt-2"
    >
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

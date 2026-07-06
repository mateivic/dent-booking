// Single Chart.js registration point — bars + tooltips only, keeping the
// bundle tree-shaken. Imported (for its side effect) by every chart component.

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

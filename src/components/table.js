// File: /src/components/table.js
export function renderTable({ columns, rows }) {
  const head = `<tr>${columns.map(c => `<th>${c.label}</th>`).join("")}</tr>`;
  const body = rows.map(r => `<tr>${columns.map(c => `<td>${c.value(r)}</td>`).join("")}</tr>`).join("");
  return `<div class="tableWrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

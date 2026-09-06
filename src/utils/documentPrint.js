// Impressão/PDF de documentos gerados em HTML, reaproveitável por qualquer
// módulo. Extraído do padrão inline handlePrintDocument/handleDownloadPDF de
// App.jsx (L5514+) para uso pelo módulo CLT, sem tocar no fluxo de
// estagiários — mesmo layout (fonte Inter via Google Fonts) e mesmo CDN
// carregado sob demanda para geração de PDF (html2pdf.js).

export function openPrintWindow(html, title) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <base href="${window.location.origin}/" />
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; margin: 0; padding: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${html}
        <script>
          window.onload = function () {
            window.print();
            setTimeout(() => { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export function downloadPdf(html, filename) {
  const element = document.createElement('div');
  element.innerHTML = html;

  const opt = {
    margin: 15,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  const runExport = () => {
    window.html2pdf().set(opt).from(element).save();
  };

  if (window.html2pdf) {
    runExport();
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = runExport;
    document.head.appendChild(script);
  }
}

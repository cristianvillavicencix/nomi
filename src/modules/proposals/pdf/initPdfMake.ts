type PdfMakeInstance = {
  createPdf: (docDefinition: unknown) => {
    getBlob: () => Promise<Blob>;
    download: (filename?: string) => void;
    open: () => void;
  };
  addVirtualFileSystem?: (vfsData: Record<string, string>) => void;
  vfs?: Record<string, string>;
};

let pdfMakePromise: Promise<PdfMakeInstance> | null = null;

/** Lazy-load pdfmake + fonts (kept out of the main entry bundle). */
export function getPdfMake(): Promise<PdfMakeInstance> {
  pdfMakePromise ??= Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]).then(([pdfMakeModule, vfsModule]) => {
    const instance = pdfMakeModule.default as PdfMakeInstance;
    const vfsData = (vfsModule.default ?? vfsModule) as Record<string, string>;
    if (instance.addVirtualFileSystem) {
      instance.addVirtualFileSystem(vfsData);
    } else {
      instance.vfs = vfsData;
    }
    return instance;
  });
  return pdfMakePromise;
}

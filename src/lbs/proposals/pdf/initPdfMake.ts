import pdfMake from "pdfmake/build/pdfmake";
import vfs from "pdfmake/build/vfs_fonts";

type PdfMakeInstance = typeof pdfMake & {
  addVirtualFileSystem?: (vfsData: Record<string, string>) => void;
};

const instance = pdfMake as PdfMakeInstance;

if (instance.addVirtualFileSystem) {
  instance.addVirtualFileSystem(vfs);
}

export { pdfMake };

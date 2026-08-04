import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface SourceViewerProps {
    fileUrl: string | null;
    pageNumber: number;
    highlightText?: string;
}

const SourceViewer: React.FC<SourceViewerProps> = ({ fileUrl, pageNumber }) => {
    const [numPages, setNumPages] = useState<number>(0);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    if (!fileUrl) {
        return (
            <div className="flex-1 p-4 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                Click a citation to view the source document here.
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
            <div className="bg-white p-2 border-b flex justify-between items-center text-xs text-gray-500 shadow-sm">
                <span>Page {pageNumber} of {numPages}</span>
                <div className="flex space-x-2">
                    <button className="hover:bg-gray-100 px-2 rounded">-</button>
                    <span>100%</span>
                    <button className="hover:bg-gray-100 px-2 rounded">+</button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex justify-center">
                <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="shadow-lg"
                >
                    <Page 
                        pageNumber={pageNumber} 
                        renderTextLayer={true} 
                        renderAnnotationLayer={false}
                        className="bg-white"
                    />
                </Document>
            </div>
        </div>
    );
};

export default SourceViewer;

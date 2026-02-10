import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');

if (container) {
    try {
        const root = createRoot(container);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    } catch (error) {
        console.error("Critical Boot Error:", error);
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family: Tahoma; text-align:center; padding: 20px;">
                <h2 style="color: #e11d48;">خطا در اجرای برنامه</h2>
                <p style="color: #4b5563;">مشکلی در بارگذاری هسته سیستم رخ داده است. لطفاً صفحه را رفرش کنید.</p>
                <small style="color: #9ca3af; margin-top: 10px;">Details: ${error instanceof Error ? error.message : 'Unknown error'}</small>
            </div>
        `;
    }
}
import { Route, Routes } from 'react-router-dom';
import { TemplateGallery } from './TemplateGallery';
import { TemplatePreview } from './TemplatePreview';
import '../cv/cv.css';
import './templates.css';
export function TemplateRoutes() { return <Routes><Route path="cv-templates" element={<TemplateGallery />} /><Route path="cv-templates/:templateId" element={<TemplatePreview />} /></Routes>; }

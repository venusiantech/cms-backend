/**
 * Available website templates
 * Each template has a unique key, name, description, and preview image
 */

export interface Template {
  key: string;
  name: string;
  description: string;
  previewImage?: string;
  features: string[];
}

export const AVAILABLE_TEMPLATES: Template[] = [
  {
    key: 'modernNews',
    name: 'Modern News',
    description: 'A sleek news magazine layout with dynamic blog grid and featured articles',
    previewImage: '/templateA/assets/images/modernNews.png',
    features: [
      'Hero section with featured article',
      'Responsive blog grid layout',
      'SEO-optimized structure',
      'Contact form integration',
      'Dynamic navbar',
    ],
  },
  {
    key: 'templateA',
    name: 'Template A',
    description: 'Professional business template with elegant design and modern features',
    previewImage: '/templateA/assets/images/TemplateA.png',
    features: [
      'Clean and professional layout',
      'Modern design elements',
      'Optimized for business sites',
      'Fully responsive design',
      'Easy to customize',
    ],
  },
];

/**
 * Get all available templates
 */
export const getAvailableTemplates = (): Template[] => {
  return AVAILABLE_TEMPLATES;
};

/**
 * Check if a template key is valid
 */
export const isValidTemplate = (templateKey: string): boolean => {
  return AVAILABLE_TEMPLATES.some((t) => t.key === templateKey);
};

/**
 * Get template by key
 */
export const getTemplateByKey = (templateKey: string): Template | undefined => {
  return AVAILABLE_TEMPLATES.find((t) => t.key === templateKey);
};

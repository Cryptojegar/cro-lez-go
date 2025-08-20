export interface AuditItem {
  id: string;
  title: string;
  description: string;
  status?: 'pass' | 'fail' | 'optional' | null;
  explanation?: string;
  image?: File | null;
}

export interface AuditSection {
  id: string;
  title: string;
  description: string;
  items: AuditItem[];
}

export const auditSections: AuditSection[] = [
  {
    id: 'homepage-experience',
    title: 'Homepage Experience',
    description: 'Critical first impression and user engagement',
    items: [
      {
        id: 'he-1',
        title: 'Clear value proposition (above the fold)',
        description: 'Visitors understand what you offer immediately'
      },
      {
        id: 'he-2',
        title: 'Strong visual hierarchy (text size, color contrast, image placement)',
        description: 'Content is organized with clear visual importance'
      },
      {
        id: 'he-3',
        title: 'Primary CTA is obvious and enticing',
        description: 'Main call-to-action stands out and motivates action'
      },
      {
        id: 'he-4',
        title: 'Secondary CTA available (for users not ready to convert)',
        description: 'Alternative action for visitors not ready for primary conversion'
      },
      {
        id: 'he-5',
        title: 'Fast loading time (<3 seconds)',
        description: 'Homepage loads quickly on all devices'
      },
      {
        id: 'he-6',
        title: 'Mobile responsive design',
        description: 'Site adapts perfectly to all screen sizes'
      },
      {
        id: 'he-7',
        title: 'Trust signals (e.g., testimonials, review stars, certifications)',
        description: 'Social proof and credibility indicators are visible'
      },
      {
        id: 'he-8',
        title: 'Avoid unnecessary distractions (e.g., auto-play videos, excessive popups)',
        description: 'Clean interface without annoying interruptions'
      },
      {
        id: 'he-9',
        title: 'First impression is clean, modern, and branded',
        description: 'Professional appearance that reflects brand identity'
      }
    ]
  },
  {
    id: 'navigation-structure',
    title: 'Navigation & Site Structure',
    description: 'Intuitive site architecture and user flow',
    items: [
      {
        id: 'ns-1',
        title: 'Intuitive, well-labeled menu categories',
        description: 'Clear navigation with logical organization'
      },
      {
        id: 'ns-2',
        title: 'Header stays visible (sticky) on scroll',
        description: 'Navigation remains accessible while scrolling'
      },
      {
        id: 'ns-3',
        title: 'Easy-to-use search bar that returns relevant results',
        description: 'Search functionality is effective and user-friendly'
      },
      {
        id: 'ns-4',
        title: 'Breadcrumbs for back navigation',
        description: 'Users can easily track and navigate their location'
      },
      {
        id: 'ns-5',
        title: 'No broken links or 404 errors',
        description: 'All internal links function properly'
      },
      {
        id: 'ns-6',
        title: 'Logical information architecture with scannable menus',
        description: 'Site structure is intuitive and easy to scan'
      }
    ]
  },
  {
    id: 'product-service-pages',
    title: 'Product / Service Pages',
    description: 'Content that drives purchase decisions',
    items: [
      {
        id: 'ps-1',
        title: 'Clear, benefit-driven product or service descriptions',
        description: 'Descriptions focus on benefits and value proposition'
      },
      {
        id: 'ps-2',
        title: 'High-quality images (with zoom or alternative angles)',
        description: 'Professional visuals with interactive features'
      },
      {
        id: 'ps-3',
        title: 'Pricing and CTAs are prominent',
        description: 'Price points and action buttons are clearly visible'
      },
      {
        id: 'ps-4',
        title: 'Delivery, returns, and guarantees clearly explained',
        description: 'Shipping and policy information is accessible'
      },
      {
        id: 'ps-5',
        title: 'Product reviews and ratings displayed',
        description: 'Customer feedback and ratings are visible'
      },
      {
        id: 'ps-6',
        title: '"Related products" or "You may also like" suggestions',
        description: 'Cross-selling opportunities are presented effectively'
      },
      {
        id: 'ps-7',
        title: 'Minimal distractions; focus is on conversion',
        description: 'Page design prioritizes conversion goals'
      },
      {
        id: 'ps-8',
        title: 'FOMO or urgency elements (e.g., limited stock, timers) if appropriate',
        description: 'Scarcity tactics used appropriately to drive action'
      }
    ]
  },
  {
    id: 'cart-checkout',
    title: 'Cart & Checkout Process',
    description: 'Optimized purchase funnel',
    items: [
      {
        id: 'cc-1',
        title: 'Cart is always accessible and editable',
        description: 'Shopping cart can be viewed and modified easily'
      },
      {
        id: 'cc-2',
        title: 'Clean layout with clear progress indicator',
        description: 'Checkout process shows current step and progress'
      },
      {
        id: 'cc-3',
        title: 'Minimal checkout steps (<4 steps ideal)',
        description: 'Streamlined process with minimal friction'
      },
      {
        id: 'cc-4',
        title: 'Guest checkout option available',
        description: 'Users can purchase without account creation'
      },
      {
        id: 'cc-5',
        title: 'Trust badges (SSL, payment logos) visible',
        description: 'Security indicators build customer confidence'
      },
      {
        id: 'cc-6',
        title: 'Summary of charges, delivery, and payment is easy to find',
        description: 'All transaction details are clearly displayed'
      },
      {
        id: 'cc-7',
        title: 'Clear CTA buttons ("Continue", "Pay Now") stand out',
        description: 'Action buttons are prominent and clearly labeled'
      },
      {
        id: 'cc-8',
        title: 'Error handling and form validation are user-friendly',
        description: 'Helpful error messages and validation feedback'
      }
    ]
  },
  {
    id: 'user-experience',
    title: 'User Experience Enhancements',
    description: 'Polish and accessibility improvements',
    items: [
      {
        id: 'ue-1',
        title: 'Consistent use of typography, spacing, and color',
        description: 'Design system is consistently applied'
      },
      {
        id: 'ue-2',
        title: 'Icons and images support user understanding',
        description: 'Visual elements enhance comprehension'
      },
      {
        id: 'ue-3',
        title: 'Modals, popups, and alerts are styled and non-intrusive',
        description: 'Overlay elements are well-designed and appropriate'
      },
      {
        id: 'ue-4',
        title: 'Microinteractions (hover states, button feedback) add polish',
        description: 'Small animations and feedback enhance experience'
      },
      {
        id: 'ue-5',
        title: 'Accessibility features considered (e.g., contrast, screen reader support)',
        description: 'Site is accessible to users with disabilities'
      },
      {
        id: 'ue-6',
        title: 'Animation or transitions are subtle and enhance usability',
        description: 'Motion design improves user experience'
      }
    ]
  },
  {
    id: 'speed-performance',
    title: 'Speed & Performance',
    description: 'Technical optimization for better user experience',
    items: [
      {
        id: 'sp-1',
        title: 'Website loads in under 3 seconds',
        description: 'Fast loading times across all pages'
      },
      {
        id: 'sp-2',
        title: 'Optimized images (WebP, proper sizing)',
        description: 'Images are compressed and properly formatted'
      },
      {
        id: 'sp-3',
        title: 'Scripts and third-party tools minimized',
        description: 'External scripts are optimized and minimal'
      },
      {
        id: 'sp-4',
        title: 'Lazy loading for images/content',
        description: 'Content loads as needed to improve performance'
      },
      {
        id: 'sp-5',
        title: 'CDN used for global content delivery',
        description: 'Content delivery network improves global performance'
      }
    ]
  },
  {
    id: 'mobile-optimization',
    title: 'Mobile Optimization',
    description: 'Mobile-first design and functionality',
    items: [
      {
        id: 'mo-1',
        title: 'Fully responsive design',
        description: 'Layout adapts perfectly to all mobile devices'
      },
      {
        id: 'mo-2',
        title: 'Tap targets are spaced appropriately',
        description: 'Touch targets are properly sized and spaced'
      },
      {
        id: 'mo-3',
        title: 'Buttons and forms are easy to use on small screens',
        description: 'Mobile interaction elements are optimized'
      },
      {
        id: 'mo-4',
        title: 'Key information appears without excessive scrolling',
        description: 'Important content is accessible on mobile'
      },
      {
        id: 'mo-5',
        title: 'Mobile-specific navigation is intuitive',
        description: 'Navigation works well on mobile devices'
      }
    ]
  },
  {
    id: 'analytics-tracking',
    title: 'Analytics & Conversion Tracking',
    description: 'Data collection and performance measurement',
    items: [
      {
        id: 'at-1',
        title: 'Google Analytics or equivalent installed',
        description: 'Web analytics tracking is properly configured'
      },
      {
        id: 'at-2',
        title: 'Conversion events set up (add to cart, signups, purchases)',
        description: 'Key actions are tracked as conversion events'
      },
      {
        id: 'at-3',
        title: 'Heatmaps and session recording enabled (e.g., Hotjar, Clarity)',
        description: 'User behavior is visually tracked and recorded'
      },
      {
        id: 'at-4',
        title: 'Funnel analysis tools set up to detect drop-off points',
        description: 'Conversion paths are monitored for optimization'
      }
    ]
  },
  {
    id: 'trust-social-proof',
    title: 'Trust & Social Proof',
    description: 'Building credibility and confidence',
    items: [
      {
        id: 'ts-1',
        title: 'Visible user testimonials or star ratings',
        description: 'Customer feedback is prominently displayed'
      },
      {
        id: 'ts-2',
        title: 'Display of partner or media logos (if applicable)',
        description: 'Third-party endorsements and partnerships shown'
      },
      {
        id: 'ts-3',
        title: 'Linked and active social media profiles',
        description: 'Social media presence is connected and maintained'
      },
      {
        id: 'ts-4',
        title: 'Blog or educational resources available for engagement',
        description: 'Value-added content builds authority and trust'
      }
    ]
  },
  {
    id: 'forms-lead-capture',
    title: 'Forms & Lead Capture',
    description: 'Optimized data collection and lead generation',
    items: [
      {
        id: 'fl-1',
        title: 'Forms are short and focused on key data only',
        description: 'Forms request minimal, essential information'
      },
      {
        id: 'fl-2',
        title: 'Field labels are clear and consistent',
        description: 'Form fields have descriptive, standardized labels'
      },
      {
        id: 'fl-3',
        title: 'Error messages are informative and placed near the field',
        description: 'Validation feedback is helpful and contextual'
      },
      {
        id: 'fl-4',
        title: 'Confirmation messages or thank-you pages are shown',
        description: 'Users receive clear submission confirmation'
      },
      {
        id: 'fl-5',
        title: 'Trust signals or privacy assurances are displayed',
        description: 'Data protection and privacy policies are visible'
      }
    ]
  }
];
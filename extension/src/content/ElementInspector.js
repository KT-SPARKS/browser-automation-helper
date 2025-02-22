// Import the analyzer
// import ElementAnalyzer from './ElementAnalyzer';
(() => {
  function createOverlay(type) {
    const overlay = document.createElement('div');
    overlay.className = `element-inspector-highlight ${type}`;
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      transition: all 0.2s ease;
      box-sizing: border-box;
      display: none;
      z-index: 10000;
    `;
    return overlay;
  }

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .element-inspector-highlight {
        position: fixed;
        pointer-events: none;
        transition: all 0.2s ease;
        box-sizing: border-box;
      }
      .element-inspector-highlight.primary {
        border: 2px solid #FF4444;
        background-color: rgba(255, 68, 68, 0.1);
        z-index: 10000;
      }
      .element-inspector-highlight.related {
        border: 2px solid #44FF44;
        background-color: rgba(68, 255, 68, 0.1);
        z-index: 9999;
      }
      .element-inspector-highlight.pattern {
        border: 2px solid #4444FF;
        background-color: rgba(68, 68, 255, 0.1);
        z-index: 9998;
      }
    `;
    document.head.appendChild(style);
  }

  class ElementInspector {

    constructor() {
      // Verify ElementAnalyzer is available
      if (!window.ElementAnalyzer) {
        console.error('ElementAnalyzer not found');
        throw new Error('ElementAnalyzer not found');
      }

      // Initialize state
      this.active = false;
      this.analyzer = new window.ElementAnalyzer();
      this.hoveredElement = null;
      this.relatedOverlays = [];
      this.highlightedElements = new Set();

      // Create overlays
      this.highlightOverlay = createOverlay('primary');
      document.body.appendChild(this.highlightOverlay);

      // Create tooltip
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.className = 'element-inspector-tooltip';
      this.tooltipElement.style.cssText = `
        position: fixed;
        padding: 8px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10001;
        max-width: 300px;
        pointer-events: none;
        display: none;
        font-family: monospace;
      `;
      document.body.appendChild(this.tooltipElement);

      // Add styles
      addStyles();

      // Bind all event handlers
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleMouseOver = this.handleMouseOver.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleKeyPress = this.handleKeyPress.bind(this);

      console.log('ElementInspector initialized successfully');
    }

    start() {
      console.log('Starting inspector');
      this.active = true;
      document.body.style.cursor = 'crosshair';
      
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseover', this.handleMouseOver);
      document.addEventListener('click', this.handleClick, true);
      document.addEventListener('keydown', this.handleKeyPress);
    }

    stop() {
      console.log('Stopping inspector');
      this.active = false;
      document.body.style.cursor = 'default';
      
      if (this.highlightOverlay) {
        this.highlightOverlay.style.display = 'none';
      }
      if (this.tooltipElement) {
        this.tooltipElement.style.display = 'none';
      }
      this.clearRelatedOverlays();
      
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseover', this.handleMouseOver);
      document.removeEventListener('click', this.handleClick, true);
      document.removeEventListener('keydown', this.handleKeyPress);
    }

    handleClick(event) {
      if (!this.active) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      const element = event.target;
      try {
        const analysis = this.analyzer.analyzeElement(element);
        const elementInfo = {
          ...this.getElementInfo(element),
          analysis: analysis,
          url: window.location.href,
          timestamp: new Date().toISOString()
        };
    
        // Send to background script
        chrome.runtime.sendMessage({
          action: 'elementSelected',
          elementInfo: elementInfo
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending element info:', chrome.runtime.lastError);
          } else {
            console.log('Element info sent successfully');
          }
        });
    
      } catch (error) {
        console.error('Error in handleClick:', error);
      }
      
      this.stop();
    }
    
    handleKeyPress(event) {
      if (!this.active) return;
      
      if (event.key === 'Escape') {
        event.preventDefault();
        this.stop();
      }
    }

    handleMouseMove(event) {
      if (!this.active) return;
      this.updateTooltip(this.hoveredElement || event.target, event);
    }

    handleMouseOver(event) {
      if (!this.active) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      this.hoveredElement = event.target;
      
      try {
        // Analyze the element
        const analysis = this.analyzer.analyzeElement(this.hoveredElement);
        
        // Update highlights
        this.updateHighlights(this.hoveredElement, analysis);
        
        // Update tooltip
        this.updateTooltip(this.hoveredElement, event);
      } catch (error) {
        console.error('Error in handleMouseOver:', error);
      }
    }

    updateHighlights(element, analysis) {
      try {
        // Clear previous highlights
        this.clearRelatedOverlays();
        
        // Highlight main element
        if (element && this.highlightOverlay) {
          const rect = element.getBoundingClientRect();
          this.highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
          this.highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
          this.highlightOverlay.style.width = `${rect.width}px`;
          this.highlightOverlay.style.height = `${rect.height}px`;
          this.highlightOverlay.style.display = 'block';
        }
        
        // Rest of your highlighting code...
      } catch (error) {
        console.error('Error in updateHighlights:', error);
      }
    }


    // Continuing ElementInspector class...

    updateTooltip(element, event) {
      const analysis = this.analyzer.analyzeElement(element);
      const info = this.getElementInfo(element);
      
      let tooltipContent = `
        <div style="margin-bottom: 4px">
          <b>${info.tagName}</b>${info.id ? ` #${info.id}` : ''}
        </div>
      `;

      // Add classes
      if (info.className) {
        tooltipContent += `
          <div style="color: #AFF">
            ${info.className.split(' ').map(c => `.${c}`).join(' ')}
          </div>
        `;
      }

      // Add relevant attributes
      const relevantAttrs = this.getRelevantAttributes(element);
      if (relevantAttrs.length > 0) {
        tooltipContent += `
          <div style="color: #FFA; margin-top: 4px">
            ${relevantAttrs.map(attr => `${attr.name}="${attr.value}"`).join('\n')}
          </div>
        `;
      }

      // Add pattern information
      if (analysis.patterns.repeatingStructures.length > 0) {
        tooltipContent += `
          <div style="color: #AAF; margin-top: 4px">
            Pattern: ${analysis.patterns.repeatingStructures.length} similar elements
          </div>
        `;
      }

      // Add relationship information
      const relationships = analysis.relationships;
      if (relationships.length > 0) {
        tooltipContent += `
          <div style="color: #AFA; margin-top: 4px">
            Related: ${relationships.length} elements
          </div>
        `;
      }

      // Update tooltip content and position
      this.tooltipElement.innerHTML = tooltipContent;
      this.positionTooltip(event);
    }

    positionTooltip(event) {
      const tooltip = this.tooltipElement;
      const tooltipRect = tooltip.getBoundingClientRect();
      const margin = 10;

      // Initial position at cursor
      let left = event.clientX + margin;
      let top = event.clientY + margin;

      // Adjust if would go off screen
      if (left + tooltipRect.width > window.innerWidth) {
        left = window.innerWidth - tooltipRect.width - margin;
      }
      if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height - margin;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
      tooltip.style.display = 'block';
    }

    positionOverlay(overlay, element) {
      const rect = element.getBoundingClientRect();
      overlay.style.top = `${rect.top + window.scrollY}px`;
      overlay.style.left = `${rect.left + window.scrollX}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.display = 'block';
    }

    clearRelatedOverlays() {
      this.relatedOverlays.forEach(overlay => {
        overlay.remove();
      });
      this.relatedOverlays = [];
    }

    hideOverlay(overlay) {
      if (overlay) {
        overlay.style.display = 'none';
      }
    }

    getElementInfo(element) {
      return {
        tagName: element.tagName.toLowerCase(),
        id: element.id,
        className: element.className,
        xpath: this.generateXPath(element),
        cssSelector: this.generateCssSelector(element),
        attributes: this.getRelevantAttributes(element),
        text: element.textContent.trim().substring(0, 100),
        role: element.getAttribute('role') || this.getImplicitRole(element)
      };
    }

    getRelevantAttributes(element) {
      return Array.from(element.attributes)
        .filter(attr => {
          const name = attr.name.toLowerCase();
          // Filter out some common non-identifying attributes
          return !['id', 'class', 'style'].includes(name) &&
                !name.startsWith('aria-') &&
                !name.startsWith('data-v-') && // Vue.js
                !name.startsWith('data-react') && // React
                !name.startsWith('ng-'); // Angular
        });
    }

    generateXPath(element) {
      const paths = [];
      let current = element;
      
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousSibling;
        
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && 
              sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }
        
        const tagName = current.tagName.toLowerCase();
        paths.unshift(`${tagName}[${index}]`);
        current = current.parentNode;
      }
      
      return `/${paths.join('/')}`;
    }

    generateCssSelector(element) {
      const paths = [];
      let current = element;
      
      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
          selector += `#${current.id}`;
          paths.unshift(selector);
          break;
        }
        
        if (current.className) {
          selector += `.${Array.from(current.classList).join('.')}`;
        }
        
        // Add attribute selectors for key attributes
        const keyAttrs = this.getRelevantAttributes(current)
          .filter(attr => this.isIdentifyingAttribute(attr.name));
        
        if (keyAttrs.length > 0) {
          selector += keyAttrs
            .map(attr => `[${attr.name}="${attr.value}"]`)
            .join('');
        }
        
        paths.unshift(selector);
        current = current.parentNode;
        
        // Stop if we have a unique selector
        if (document.querySelectorAll(paths.join(' > ')).length === 1) {
          break;
        }
      }
      
      return paths.join(' > ');
    }

    isIdentifyingAttribute(name) {
      return ['name', 'type', 'role', 'data-testid', 'data-id'].includes(name);
    }

    getImplicitRole(element) {
      // Map of elements to their implicit ARIA roles
      const roleMap = {
        a: 'link',
        article: 'article',
        aside: 'complementary',
        button: 'button',
        form: 'form',
        h1: 'heading',
        h2: 'heading',
        h3: 'heading',
        h4: 'heading',
        h5: 'heading',
        h6: 'heading',
        header: 'banner',
        input: this.getInputRole(element),
        img: 'img',
        li: 'listitem',
        main: 'main',
        nav: 'navigation',
        ol: 'list',
        section: 'region',
        table: 'table',
        ul: 'list'
      };
      
      return roleMap[element.tagName.toLowerCase()] || '';
    }

    getInputRole(element) {
      const inputRoles = {
        checkbox: 'checkbox',
        radio: 'radio',
        range: 'slider',
        search: 'searchbox',
        text: 'textbox',
        number: 'spinbutton'
      };
      return inputRoles[element.type] || 'textbox';
    }
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeInspector);
  } else {
    initializeInspector();
  }

  // Initialize the inspector
  function initializeInspector() {
    if (!window.elementInspector) {
      try {
        window.elementInspector = new ElementInspector();
        return true;
      } catch (error) {
        console.error('Failed to initialize ElementInspector:', error);
        return false;
      }
    }
    return true;
  }

  // Try to initialize immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeInspector);
  } else {
    initializeInspector();
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startInspector') {
      try {
        if (!window.elementInspector && !initializeInspector()) {
          throw new Error('Failed to initialize inspector');
        }
        window.elementInspector.start();
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error starting inspector:', error);
        sendResponse({ success: false, error: error.message });
      }
      return false; // Don't keep message channel open
    }
  });

})();
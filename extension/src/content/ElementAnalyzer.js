// ElementAnalyzer.js - Intelligent DOM pattern detection and element analysis
(() => {

  class ElementAnalyzer {
    constructor() {
      this.patterns = new Map();
      this.relationshipCache = new WeakMap();
    }

    analyzeStructure(element) {
      const structure = {
        depth: 0,
        siblings: 0,
        similarSiblings: 0,
        children: element.children.length,
        isRepeating: false,
        containerId: null,
        patternGroup: null
      };

      let parent = element.parentElement;
      let current = element;
      
      while (parent && parent !== document.body) {
        structure.depth++;
        
        const siblings = Array.from(parent.children);
        structure.siblings = siblings.length;
        
        structure.similarSiblings = siblings.filter(sibling => 
          sibling !== current && this.calculateSimilarity(current, sibling) > 0.8
        ).length;

        if (this.isLikelyContainer(parent)) {
          structure.containerId = this.getContainerSignature(parent);
        }

        current = parent;
        parent = parent.parentElement;
      }

      structure.isRepeating = structure.similarSiblings > 0;
      if (structure.isRepeating) {
        structure.patternGroup = this.identifyPatternGroup(element);
      }

      return structure;
    }

    findPatterns(element) {
      const patterns = {
        repeatingStructures: [],
        commonAttributes: new Set(),
        layoutPattern: this.detectLayoutPattern(element),
        interactionPattern: this.detectInteractionPattern(element)
      };

      const signature = this.generateStructureSignature(element);
      const similar = this.findSimilarStructures(element, signature);
      
      if (similar.length > 0) {
        patterns.repeatingStructures = similar.map(el => ({
          element: el,
          similarity: this.calculateSimilarity(element, el),
          relationship: this.determineRelationship(element, el)
        }));
      }

      const contextElements = this.getContextElements(element);
      patterns.commonAttributes = this.findCommonAttributes(contextElements);

      return patterns;
    }

    findRelationships(element) {
      if (this.relationshipCache.has(element)) {
        return this.relationshipCache.get(element);
      }

      const relationships = [];
      const container = this.findClosestStructuralContainer(element);
      
      if (container) {
        // Find siblings with similar structure
        Array.from(container.children).forEach(child => {
          if (child !== element && this.calculateSimilarity(element, child) > 0.5) {
            relationships.push(child);
          }
        });

        // Find semantically related elements
        this.findSemanticRelationships(element, relationships, container);
      }

      this.relationshipCache.set(element, relationships);
      return relationships;
    }

    findSemanticRelationships(element, relationships, container) {
      // Handle form elements
      if (element instanceof HTMLInputElement && element.id) {
        const label = container.querySelector(`label[for="${element.id}"]`);
        if (label) relationships.push(label);
      }

      // Handle table cells
      if (element instanceof HTMLTableCellElement) {
        const row = element.parentElement;
        if (row) {
          Array.from(row.cells).forEach(cell => {
            if (cell !== element) relationships.push(cell);
          });
        }
      }

      // Handle list items
      if (element instanceof HTMLLIElement) {
        const list = element.parentElement;
        if (list) {
          Array.from(list.children).forEach(item => {
            if (item !== element) relationships.push(item);
          });
        }
      }
    }

    calculateSimilarity(el1, el2) {
      let score = 0;
      let checks = 0;

      // Compare tag names
      if (el1.tagName === el2.tagName) score++;
      checks++;

      // Compare classes
      const classes1 = new Set(el1.classList);
      const classes2 = new Set(el2.classList);
      const commonClasses = Array.from(classes1).filter(c => classes2.has(c));
      score += commonClasses.length / Math.max(classes1.size, classes2.size);
      checks++;

      // Compare structure
      const struct1 = this.generateStructureSignature(el1);
      const struct2 = this.generateStructureSignature(el2);
      if (struct1 === struct2) score++;
      checks++;

      return score / checks;
    }

    determineRelationship(el1, el2) {
      if (el1.parentElement === el2.parentElement) return 'sibling';
      if (el1.contains(el2)) return 'parent';
      if (el2.contains(el1)) return 'child';
      return 'related';
    }

    generateStructureSignature(element) {
      return `${element.tagName.toLowerCase()}[${element.className}]{${Array.from(element.children).map(c => c.tagName.toLowerCase()).join(',')}}`;
    }

    generateSelectors(element) {
      return {
        css: this.generateCssSelector(element),
        xpath: this.generateXPath(element)
      };
    }

    generateCssSelector(element) {
      const path = [];
      let current = element;
      
      while (current) {
        if (current.id) {
          path.unshift('#' + current.id);
          break;
        } else {
          let selector = current.tagName.toLowerCase();
          if (current.className) {
            selector += '.' + Array.from(current.classList).join('.');
          }
          path.unshift(selector);
        }
        current = current.parentElement;
      }
      
      return path.join(' > ');
    }

    generateXPath(element) {
      const paths = [];
      let current = element;
      
      while (current) {
        if (current.id) {
          paths.unshift(`//*[@id="${current.id}"]`);
          break;
        } else {
          let index = 1;
          let sibling = current.previousElementSibling;
          
          while (sibling) {
            if (sibling.tagName === current.tagName) index++;
            sibling = sibling.previousElementSibling;
          }
          
          paths.unshift(`${current.tagName.toLowerCase()}[${index}]`);
        }
        current = current.parentElement;
      }
      
      return paths.join('/');
    }



    // Add a static test method for verification
    static test() {
      try {
        const analyzer = new ElementAnalyzer();
        return analyzer.analyzeElement && typeof analyzer.analyzeElement === 'function';
      } catch (e) {
        return false;
      }
    }

    analyzeElement(element) {
      if (!element || !(element instanceof HTMLElement)) {
        console.warn('Invalid element provided to analyzeElement:', element);
        return {
          structure: {},
          patterns: { repeatingStructures: [] },
          relationships: [],
          selectors: {}
        };
      }

      try {
        return {
          structure: this.analyzeStructure(element),
          patterns: this.findPatterns(element),
          relationships: this.findRelationships(element),
          selectors: this.generateSelectors(element)
        };
      } catch (error) {
        console.error('Error analyzing element:', error);
        return {
          structure: {},
          patterns: { repeatingStructures: [] },
          relationships: [],
          selectors: {}
        };
      }
    }


    /**
     * Checks if an element is likely to be a container
     * @param {HTMLElement} element 
     * @returns {boolean}
     */
    isLikelyContainer(element) {
      // Common container elements
      const containerTags = [
        'div', 'section', 'article', 'main', 'aside', 'nav',
        'header', 'footer', 'form', 'ul', 'ol', 'table'
      ];

      // Check tag name
      if (containerTags.includes(element.tagName.toLowerCase())) {
        return true;
      }

      // Check role attribute
      const role = element.getAttribute('role');
      if (role && ['group', 'list', 'grid', 'tablist'].includes(role)) {
        return true;
      }

      // Check common container class names
      const className = element.className.toLowerCase();
      if (className.match(/container|wrapper|content|layout|grid|flex|list/)) {
        return true;
      }

      // Check display style
      const style = window.getComputedStyle(element);
      if (['flex', 'grid', 'table'].includes(style.display)) {
        return true;
      }

      // Check if element has multiple similar children
      const children = Array.from(element.children);
      if (children.length > 1) {
        const firstChild = children[0];
        const similarChildren = children.filter(child => 
          child.tagName === firstChild.tagName &&
          child.className === firstChild.className
        );
        if (similarChildren.length > 1) {
          return true;
        }
      }

      return false;
    }

    /**
     * Generates a unique signature for a container element
     * @param {HTMLElement} element 
     * @returns {string}
     */
    getContainerSignature(element) {
      const parts = [];
      
      // Add tag name
      parts.push(element.tagName.toLowerCase());

      // Add id if present
      if (element.id) {
        parts.push(`#${element.id}`);
      }

      // Add significant classes
      const significantClasses = Array.from(element.classList)
        .filter(cls => !cls.match(/^(js-|is-|has-|active|visible|hidden)/));
      if (significantClasses.length > 0) {
        parts.push(`.${significantClasses.join('.')}`);
      }

      // Add role if present
      const role = element.getAttribute('role');
      if (role) {
        parts.push(`[role="${role}"]`);
      }

      // Add child structure signature
      const childTypes = Array.from(element.children)
        .map(child => child.tagName.toLowerCase())
        .sort()
        .join(',');
      parts.push(`{${childTypes}}`);

      return parts.join('');
    }

    /**
     * Identifies pattern group for an element
     * @param {HTMLElement} element 
     * @returns {string|null}
     */
    identifyPatternGroup(element) {
      let container = element.parentElement;
      while (container && container !== document.body) {
        if (this.isLikelyContainer(container)) {
          const siblings = Array.from(container.children);
          const similarSiblings = siblings.filter(sibling => 
            sibling !== element && this.calculateSimilarity(element, sibling) > 0.8
          );

          if (similarSiblings.length > 0) {
            return this.getContainerSignature(container);
          }
        }
        container = container.parentElement;
      }
      return null;
    }

    // ... rest of your existing ElementAnalyzer code ...

    /**
     * Find similar structures in the DOM
     * @param {HTMLElement} element 
     * @param {string} signature 
     * @returns {HTMLElement[]}
     */
    findSimilarStructures(element, signature) {
      const similar = [];
      const container = this.findClosestStructuralContainer(element);
      
      if (!container) return similar;

      const candidates = container.querySelectorAll(element.tagName);
      candidates.forEach(candidate => {
        if (candidate !== element) {
          const candidateSignature = this.generateStructureSignature(candidate);
          if (candidateSignature === signature) {
            similar.push(candidate);
          }
        }
      });

      return similar;
    }

    /**
     * Find the closest structural container
     * @param {HTMLElement} element 
     * @returns {HTMLElement|null}
     */
    findClosestStructuralContainer(element) {
      let current = element.parentElement;
      while (current && current !== document.body) {
        if (this.isLikelyContainer(current)) {
          return current;
        }
        current = current.parentElement;
      }
      return document.body;
    }

    /**
     * Get context elements for analysis
     * @param {HTMLElement} element 
     * @returns {HTMLElement[]}
     */
    getContextElements(element) {
      const container = this.findClosestStructuralContainer(element);
      if (!container) return [];

      return Array.from(container.children);
    }

    /**
     * Find common attributes among elements
     * @param {HTMLElement[]} elements 
     * @returns {Set<string>}
     */
    findCommonAttributes(elements) {
      if (elements.length === 0) return new Set();

      const firstElement = elements[0];
      const commonAttrs = new Set(Array.from(firstElement.attributes).map(attr => attr.name));

      elements.slice(1).forEach(element => {
        const elementAttrs = new Set(Array.from(element.attributes).map(attr => attr.name));
        for (const attr of commonAttrs) {
          if (!elementAttrs.has(attr)) {
            commonAttrs.delete(attr);
          }
        }
      });

      return commonAttrs;
    }

    /**
     * Detect layout pattern of an element
     * @param {HTMLElement} element 
     * @returns {string|null}
     */
    detectLayoutPattern(element) {
      const style = window.getComputedStyle(element);
      
      if (style.display === 'flex') {
        return `flex-${style.flexDirection}`;
      }
      
      if (style.display === 'grid') {
        return 'grid';
      }
      
      if (style.position === 'absolute' || style.position === 'fixed') {
        return 'positioned';
      }
      
      if (style.float !== 'none') {
        return 'float';
      }
      
      return null;
    }

    /**
     * Detect interaction pattern
     * @param {HTMLElement} element 
     * @returns {string|null}
     */
    detectInteractionPattern(element) {
      if (element.tagName === 'FORM') return 'form';
      if (element.tagName === 'INPUT') return 'input';
      if (element.onclick || element.getAttribute('onclick')) return 'clickable';
      if (element.getAttribute('role') === 'button') return 'button';
      
      const style = window.getComputedStyle(element);
      if (style.cursor === 'pointer') return 'clickable';
      
      return null;
    }
  }
  // Create and assign the global instance
  // Make it globally available
  try {
    window.ElementAnalyzer = ElementAnalyzer;
    console.log('ElementAnalyzer initialized successfully');
  } catch (error) {
    console.error('Failed to initialize ElementAnalyzer:', error);
  }

})();
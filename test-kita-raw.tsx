import Html from '@kitajs/html';

// Test different ways to render raw HTML in KitaJS

const html = '<p>Test <strong>HTML</strong></p>';

// Method 1: Direct string (will be escaped)
const Method1 = () => <div>{html}</div>;

// Method 2: Array (might work)
const Method2 = () => <div>{[html]}</div>;

// Method 3: Fragment with array
const Method3 = () => <div><>{[html]}</></div>;

// Method 4: Direct return as array (raw HTML)
const Method4 = () => [html];

// Method 5: Return in wrapper
const Method5 = () => <div innerHTML={html}></div>;

console.log('Method 1:', Method1());
console.log('Method 2:', Method2());
console.log('Method 3:', Method3());
console.log('Method 4:', Method4());
console.log('Method 5:', Method5());
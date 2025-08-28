import Html from '@kitajs/html';

const html = '<p>Test <strong>HTML</strong></p>';

console.log('Direct:', html);
console.log('contentsToString false:', Html.contentsToString([html], false));
console.log('contentsToString true:', Html.contentsToString([html], true));
console.log('Type of result:', typeof Html.contentsToString([html], false));
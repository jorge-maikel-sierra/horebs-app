import { escaparHtml } from './escapar-html';

describe('escaparHtml', () => {
  it('escapa &, <, > y comillas dobles', () => {
    expect(escaparHtml('<a href="x">P&G</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;P&amp;G&lt;/a&gt;',
    );
  });
});

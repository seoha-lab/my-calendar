import { inlineInitThemeScript } from '@/lib/theme';

export default function Head() {
  const init = inlineInitThemeScript();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: init }} />
    </>
  );
}

import { createRoot } from 'react-dom/client';
import Welcome from '../../src/app/page';
import SignIn from '../../src/app/signin/page';
import Onboarding from '../../src/app/onboarding/page';
import Plan from '../../src/app/plan/page';
import { usePath } from './shim-navigation';

function App() {
  const path = usePath();
  const Page = ({ '/': Welcome, '/signin': SignIn, '/onboarding': Onboarding, '/plan': Plan } as Record<string, () => React.JSX.Element>)[path] ?? Welcome;
  return <div className="wrap"><Page key={path} /></div>;
}
createRoot(document.getElementById('root')!).render(<App />);

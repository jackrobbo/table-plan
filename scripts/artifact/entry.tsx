import { createRoot } from 'react-dom/client';
import Welcome from '../../src/app/page';
import SignIn from '../../src/app/signin/page';
import Onboarding from '../../src/app/onboarding/page';
import Plan from '../../src/app/plan/page';
import PlanNext from '../../src/app/plan/next/page';
import Subscribe from '../../src/app/subscribe/page';
import Account from '../../src/app/account/page';
import { usePath } from './shim-navigation';

function App() {
  const path = usePath();
  const Page = ({ '/': Welcome, '/signin': SignIn, '/onboarding': Onboarding, '/plan': Plan, '/plan/next': PlanNext, '/subscribe': Subscribe, '/account': Account } as Record<string, () => React.JSX.Element>)[path] ?? Welcome;
  return <Page key={path} />;
}
createRoot(document.getElementById('root')!).render(<App />);

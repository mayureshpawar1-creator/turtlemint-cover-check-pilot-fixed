/** Screen router for the customer flow. One screen at a time; history drives Back. */
import { useEffect } from 'react';
import { useFlow } from './state/flow';
import { Landing } from './screens/Landing';
import { QuickCheck } from './screens/QuickCheck';
import { CoverPlan } from './screens/CoverPlan';
import { Capture } from './screens/Capture';
import { NextStep } from './screens/NextStep';
import { Confirmation } from './screens/Confirmation';
import { PlansFit } from './screens/PlansFit';
import { SummaryPreview } from './screens/SummaryPreview';
import { UploadCheck, UploadChoose, UploadConsent, UploadReading, UploadVerify } from './screens/Upload';
import { PolicyBoard } from './screens/PolicyBoard';
import { Emblem } from './illustrations';
import { errorOf } from './state/flow';

export function CustomerFlow() {
  const { s, api, dispatch, patch } = useFlow();

  useEffect(() => {
    if (s.screen !== 'BOOT') return;
    api.bootstrap().then((boot) => dispatch({ type: 'boot', boot }))
      .catch((e) => patch({ screen: 'ERROR', fatal: errorOf(e).message }));
  }, [s.screen, api, dispatch, patch]);

  switch (s.screen) {
    case 'BOOT': return <div className="screen" style={{ display: 'grid', placeItems: 'center' }} aria-busy="true"><Emblem size={48} /></div>;
    case 'ERROR': return <div className="screen"><div className="body"><h1 className="title">This link is not working</h1><p className="muted">{s.fatal}</p></div></div>;
    case 'S0': return <Landing />;
    // v4: "Get my cover plan" opens the one-screen check; the result is one screen too (no S2–S6, no S7d).
    case 'S1': case 'S2': case 'S3': case 'S4': case 'S5': case 'S6': return <QuickCheck />;
    case 'S7': case 'S7d': return <CoverPlan />;
    case 'S8': return <Capture />;
    case 'S9': return <NextStep />;
    case 'S9a': return <PlansFit />;
    case 'S9b': return <SummaryPreview />;
    case 'S10': return <Confirmation />;
    case 'U1': return <UploadConsent />;
    case 'U2': return <UploadVerify />;
    case 'U3': return <UploadChoose />;
    case 'U4': return <UploadReading />;
    case 'U5': return <UploadCheck />;
    // v5: the upload result is one screen too; U7 opens it with the whole policy in plain words
    case 'U6': return <PolicyBoard />;
    case 'U7': return <PolicyBoard startPlain />;
    case 'U8': return <NextStep fromUpload />;
  }
}

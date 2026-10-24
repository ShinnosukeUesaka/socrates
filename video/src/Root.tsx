import { Composition } from 'remotion';
import { Pitch, PITCH_TOTAL } from './Pitch';

export const RemotionRoot = () => <>
  <Composition id="CTPPitch" component={Pitch} durationInFrames={PITCH_TOTAL} fps={30} width={1920} height={1080}/>
</>;

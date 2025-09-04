import { Component } from '@angular/core';
import { AlephScriptWebRTCUIComponent } from './components/alephscript-webrtc-ui.component';

@Component({
  selector: 'wrtc-webrtc-ui-lib',
  imports: [AlephScriptWebRTCUIComponent],
  template: `
    <wrtc-alephscript-webrtc-ui></wrtc-alephscript-webrtc-ui>
  `,
  styles: ``
})
export class WebrtcUiLib {

}

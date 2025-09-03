import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebrtcUiLib } from './webrtc-ui-lib';

describe('WebrtcUiLib', () => {
  let component: WebrtcUiLib;
  let fixture: ComponentFixture<WebrtcUiLib>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebrtcUiLib]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WebrtcUiLib);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

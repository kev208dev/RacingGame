// 출발부스터 (Start Booster) — 카운트다운 末 throttle 첫 누름 타이밍 보너스.
//
// 규칙:
//   • 카운트다운 진행 중 raw input.throttle 추적.
//   • 첫 누름 시점의 countdown 값을 _sbThrottleDownAt에 기록.
//   • 누른 채로 (press_countdown - now_countdown) > FLOOD_LIMIT 가면 flood = 무효.
//   • Throttle 떼면 _sbThrottleDownAt 리셋 (재누름 가능).
//   • GO 전환 시: !flooded && _sbThrottleDownAt ≤ WINDOW → fireStartBoost.
//
// 호출:
//   initStartBoostState(car)              // 레이스 리셋 시
//   tickStartBoost(car, rawInput, countdown, released)
//                                         // 매 프레임 (raceReleased 갱신 후)

import { KART_TUNING as K } from './config.js';

export function initStartBoostState(car) {
  car._sbThrottleDownAt = null;
  car._sbFlooded       = false;
  car._sbPrevReleased  = false;
  car.startBoostFired  = false;
}

export function tickStartBoost(car, rawInput, countdown, released) {
  const wasReleased = !!car._sbPrevReleased;
  car._sbPrevReleased = released;

  if (!released) {
    const thr = (rawInput.throttle || 0) > 0.5;
    if (thr) {
      if (car._sbThrottleDownAt === null) {
        car._sbThrottleDownAt = countdown;
      } else {
        const held = car._sbThrottleDownAt - countdown;
        if (held > K.START_BOOST_FLOOD_LIMIT) car._sbFlooded = true;
      }
    } else {
      car._sbThrottleDownAt = null;
    }
    return;
  }

  // released
  if (!wasReleased) {
    // GO transition
    const downAt = car._sbThrottleDownAt;
    if (!car._sbFlooded && downAt !== null && downAt <= K.START_BOOST_WINDOW) {
      fireStartBoost(car);
    }
  }
}

export function fireStartBoost(car) {
  const fwdX = Math.cos(car.angle);
  const fwdY = Math.sin(car.angle);
  const rgtX = -fwdY;
  const rgtY =  fwdX;
  let vF = car.vx * fwdX + car.vy * fwdY;
  let vL = car.vx * rgtX + car.vy * rgtY;
  vF += K.START_BOOST_DV;
  car.vx = fwdX * vF + rgtX * vL;
  car.vy = fwdY * vF + rgtY * vL;

  car.boostSustainTimer  = K.START_BOOST_SUSTAIN_TIME;
  car.boostCapDecayTimer = 0;
  car.boosting           = true;
  car.boostFireFx        = 1.0;
  car.startBoostFired    = true;
}

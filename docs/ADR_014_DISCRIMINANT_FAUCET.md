# ADR-014: Clean Chart-Ratio Discriminant Astrological Faucet Engine

**Status:** Accepted & Implemented  
**Date:** September 2026  
**Calibration:** Universal 12.0000 ESMS Daily Grant (No Premium Tier)

---

## 1. Context & Problem Statement

Prior to ADR-014, the daily token yield across Alchm Agents and Alchm Kitchen was allocated via a flat split of `AGENT_DAILY_YIELD / 4` (flat 6.0 tokens per axis under the legacy 24-token budget). This uniform distribution ignored the agent's authentic natal chart placements and real-time celestial transits.

As a result, an acute **2.75× supply distortion** developed across the token economy:

- **MATTER** accumulated into a stagnant, unearned surplus (**29,144 tokens / 37.51%** of network supply).
- **SPIRIT** suffered chronic depletion (**10,601 tokens / 13.64%** of network supply), starving agents of the kinetic energy required to fuel consultation chats.

Legacy attempts to remediate this via artificial sect hacks, wave functions, or arbitrary bonus multipliers caused inflationary drift and unpredictable token volatility.

---

## 2. Decision: Clean Chart-Ratio Formulation

ADR-014 implements a proportional, clean chart-ratio formulation that dynamically prices daily token yield based on three authentic components:

$$Y_i = \text{Quantize}\left( Y_{\text{total}} \cdot \frac{r_i(N) \cdot w_i(t) \cdot \Omega_i}{\sum_j r_j(N) \cdot w_j(t) \cdot \Omega_j} \right)$$

### 2.1 Natal Chart Ratio Vector: $r_i(N)$

Derived from the agent's authentic astrological chart scores across Fire (Spirit), Water (Essence), Earth (Matter), and Air (Substance):
$$r_i(N) = \frac{\text{score}_i}{\sum_{k} \text{score}_k}$$
If an agent has neutral or unconfigured scores, equal proportions ($0.25$ each) are used.

### 2.2 Live Celestial Moment Transit Weights: $w_i(t)$

Evaluates live astronomical planetary positions (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto) mapped to their respective element signs (Aries/Leo/Sagittarius $\to$ Fire; Cancer/Scorpio/Pisces $\to$ Water; Taurus/Virgo/Capricorn $\to$ Earth; Gemini/Libra/Aquarius $\to$ Air):
$$w_i(t) = \frac{\text{weight}_i}{\sum_{k} \text{weight}_k}$$

### 2.3 Counter-Cyclical Anti-Glut Damping: $\Omega_i$

Protects network liquidity from compounding existing surpluses. When an element's share of global network supply exceeds $30\%$, its yield is dampened:
$$\Omega_i = \max\left(0.65, 1.0 - 2.0 \cdot (\text{share}_i - 0.25)\right)$$
Under the live network supply (MATTER at $37.51\%$), $\Omega_{\text{MATTER}} = 0.750$, suppressing new MATTER issuance by $25\%$.

### 2.4 Strict 4-Decimal Residual Conservation: $Y_{\text{total}} = 12.0000$

Each yield quantity is quantized to 4 decimal places. Any residual rounding difference between the sum of quantized tokens and $Y_{\text{total}}$ is absorbed by the claimer's dominant natal element, ensuring **exact mathematical conservation to the 4th decimal place ($12.0000$ ESMS)** on every single claim.

---

## 3. Protocol Calibration: 12.0000 ESMS Universal Grant

The daily login grant is calibrated to **12.0000 ESMS** universally across all users and agents:

1. **Halves Passive Inflation:** Prevents unearned surplus accumulation and tightens economic velocity.
2. **Accelerates Surplus Drain:** Compresses new MATTER creation to **1.1674 – 2.0171** tokens/day (under the 0.750 anti-glut factor), accelerating the drain of the 29.1k historical kitchen glut.
3. **Guarantees Kinetic Gas:** Still grants **6.4053 SPIRIT** during Fire skies (up to **~7.25** for high-Spirit archetypes), fully funding 25+ base chat turns at 0.25 SPIRIT gas.
4. **Eliminates "Premium" Tier Concept:** All multiplier gates (`PREMIUM_MULTIPLIER = 2.0`) and `isPremium` branching have been phased out. Daily yield is equal and universal for everyone.
5. **Drives Ecosystem Demand:** Makes high-tier operations (Oracle Chamber at 20 ESMS, The Forge at 45 ESMS, EV Reset at 50 ESMS) aspirational, catalyzing trade volume across the 6-pair AMM and StarVault staking pools.

---

## 4. Mandatory Canonical Token Identities & Symbol Tiers

| Token         | Element | Primary Glyph | Triangular Variant | Fallback Glyph | Atomic Code |
| :------------ | :------ | :-----------: | :----------------: | :------------: | :---------: |
| **SPIRIT**    | Fire    | `🝇` (U+1F747) |   `🜂` (U+1F702)    |   `△` / `▲`    |  `[SPRT]`   |
| **ESSENCE**   | Water   | `🝑` (U+1F751) |   `🜄` (U+1F704)    |   `▽` / `▼`    |  `[ESNC]`   |
| **MATTER**    | Earth   | `🝙` (U+1F759) |   `🜃` (U+1F703)    |   `⯛` / `▽—`   |  `[MATR]`   |
| **SUBSTANCE** | Air     | `🝉` (U+1F749) |   `🜁` (U+1F701)    |   `⯙` / `△—`   |  `[SUBS]`   |

---

## 5. Empirical Verification Across the 72 Historical Agents

Simulation executed via `scripts/simulate-historical-faucet.ts`:

| Moment       | Celestial Configuration     | Avg SPIRIT (`🝇`) | Avg ESSENCE (`🝑`) | Avg MATTER (`🝙`) | Avg SUBSTANCE (`🝉`) | Daily Total / Agent | Total Fleet Mint | SPRT / MATR Ratio |
| :----------- | :-------------------------- | :--------------: | :---------------: | :--------------: | :-----------------: | :-----------------: | :--------------: | :---------------: |
| **Moment 1** | **Fire Sky Transit**        |    **6.4053**    |      1.9291       |    **1.1674**    |       2.4982        |     **12.0000**     |     864 ESMS     |     **5.49×**     |
| **Moment 2** | **Water Sky Transit**       |      1.3155      |    **7.1966**     |    **1.5763**    |       1.9116        |     **12.0000**     |     864 ESMS     |     **0.83×**     |
| **Moment 3** | **Earth Stellium**          |      2.2839      |      3.0290       |    **4.4844**    |       2.2027        |     **12.0000**     |     864 ESMS     |     **0.51×**     |
| **Moment 4** | **Air Solstice**            |      2.5994      |      1.9477       |    **1.1705**    |     **6.2823**      |     **12.0000**     |     864 ESMS     |     **2.22×**     |
| **Moment 5** | **Equinoctial Equilibrium** |      3.3642      |      3.3588       |    **2.0171**    |       3.2599        |     **12.0000**     |     864 ESMS     |     **1.67×**     |

### Verified Protocol Invariants

- ✅ **Strict Conservation Invariant:** Every agent's daily sum is strictly 12.0000 ESMS (864.0000 ESMS total fleet daily mint).
- ✅ **Fire Kinetic Gas Elevation:** Fire transit elevates fleet average SPIRIT yield to 6.4053 (eliminates chat depletion).
- ✅ **Counter-Cyclical Anti-Glut Damping:** MATTER compressed to 1.15–2.05 in Fire/Air and strictly < 4.50 during Earth stelliums.
- ✅ **Authentic Differentiation:** Distinct agent charts yield divergent, authentic distributions under identical skies (e.g. Leonardo da Vinci Spirit 3.34 vs. Isaac Newton Matter 2.49 under equinox).

---

## 6. Implementation References

- `lib/services/discriminant-faucet.ts`: Canonical ADR-014 calculation engine.
- `lib/services/agent-action-service.ts`: Hourly agentic claim integration (`claimYieldForAgent`).
- `lib/economy-config.ts`: Daily yield constant definitions (`DAILY_ESMS_YIELD = 12`).
- `scripts/simulate-historical-faucet.ts`: 72-agent multi-sky validation harness.
- `test/discriminant-faucet.spec.ts`: Unit test suite verifying mathematical invariants.

# 浠ｇ爜鏀硅繘娓呭崟 鈥?宸插簲鐢?
**鏃ユ湡**: 2026-05-29  
**鐘舵€?*: 鉁?宸插畬鎴愶紙楂樹紭鍏堢骇椤圭洰锛?
---

## 馃搵 宸插疄鏂界殑鏀硅繘

### 1. 鉁?娣诲姞 .gitignore 鏂囦欢
**鏂囦欢**: `02_replication_package/.gitignore`  
**鍐呭**: 鎺掗櫎浠ヤ笅鏂囦欢绫诲瀷
- 渚濊禆: `node_modules/`, `venv/`, `env/`, `__pycache__/`
- 鏃ュ織: `*.log`, `npm-debug.log*`
- 绯荤粺鏂囦欢: `.DS_Store`, `Thumbs.db`
- IDE: `.vscode/`, `.idea/`, `*.swp`
- Python: `*.pyc`, `*.pyo`, `*.egg-info/`

**浼樺娍**: 闃叉鍦℅itHub涓婃硠闇蹭笉蹇呰鐨勬枃浠?
---

### 2. 鉁?娣诲姞 .gitattributes 鏂囦欢
**鏂囦欢**: `02_replication_package/.gitattributes`  
**鍐呭**: 瑙勮寖鍖栬缁堟绗︼紙LF锛夛紝纭繚璺ㄥ钩鍙板吋瀹规€?
**浼樺娍**: Windows 鈫?Linux 鍏嬮殕鏃堕伩鍏?CRLF 闂

---

### 3. 鉁?澧炲己杈撳叆楠岃瘉 鈥?simulator.js
**鏂囦欢**: `experiments/nodejs/src/simulator.js`  
**鏀硅繘浣嶇疆**: `run()` 鏂规硶锛堢46-63琛岋級

**娣诲姞鐨勯獙璇?*:
```javascript
// 楠岃瘉 arrivalRates 鏄暟缁?if (!Array.isArray(arrivalRates)) {
  throw new Error('arrivalRates must be an array');
}
// 楠岃瘉 interferences 鏄暟缁?if (!Array.isArray(interferences)) {
  throw new Error('interferences must be an array');
}
// 楠岃瘉闀垮害鍖归厤
if (arrivalRates.length !== interferences.length) {
  throw new Error(`length mismatch: ${arrivalRates.length} vs ${interferences.length}`);
}
// 楠岃瘉闀垮害涓庨鏈熸鏁板尮閰?if (arrivalRates.length !== this.steps) {
  throw new Error(`expected ${this.steps} steps, got ${arrivalRates.length}`);
}
// 楠岃瘉 RNG 鏄嚱鏁?if (typeof rng !== 'function') {
  throw new Error('rng must be a function');
}
```

**浼樺娍**: 
- 鎻愬墠鍙戠幇鏁版嵁涓嶅尮閰嶉棶棰?- 娓呮櫚鐨勯敊璇俊鎭究浜庤皟璇?- 闃叉鏃犳晥鏁版嵁瀵艰嚧鐨勯潤榛樺け璐?
---

### 4. 鉁?澧炲己寮傚父澶勭悊 鈥?run_experiments_CCPE.js
**鏂囦欢**: `experiments/nodejs/run_experiments_CCPE.js`  
**鏀硅繘鍐呭**:

#### a) runExperiment() 鍑芥暟
- 娣诲姞瀹屾暣鐨?try-catch 鍧?- 楠岃瘉 `createScenario()` 杈撳嚭
- 楠岃瘉 REPEATS 娆¤凯浠ｅ畬鎴?- 涓哄悇绉嶆晠闅滄彁渚涙竻鏅扮殑閿欒淇℃伅

```javascript
try {
  // ... experiment logic ...
} catch (err) {
  throw new Error(`${scenarioName}/${algo}: ${err.message}`);
}
```

#### b) main() 鍑芥暟
- 鏁翠釜娴佺▼鍖呰鍦?try-catch 涓?- 鏂囦欢I/O寮傚父澶勭悊
- 浼橀泤鐨勯敊璇€€鍑猴紙`process.exit(1)`锛?- 娓呮櫚鐨勯敊璇緭鍑?
**浼樺娍**:
- 浠讳綍鏁呴殰閮戒細涓柇瀹為獙锛堥槻姝㈤儴鍒嗙粨鏋滐級
- 娓呮櫚鐨勯敊璇棩蹇椾究浜庢帓鏌?- 涓嶄細鐣欎笅涓嶅畬鏁寸殑缁撴灉鏂囦欢

---

### 5. 鉁?澧炲己鏁版嵁楠岃瘉涓庡紓甯稿鐞?鈥?statistical_tests.py
**鏂囦欢**: `experiments/analysis/statistical_tests.py`  
**鏀硅繘鍐呭**:

#### a) 鏂板 `validate_data()` 鍑芥暟
```python
def validate_data(data: dict, min_reps: int = 30) -> None:
    """楠岃瘉鏁版嵁鍖呭惈棰勬湡鐨剆cenarios鍜宺eps"""
    # 妫€鏌ユ瘡涓猻cenario/algorithm鏄惁鏈夆墺30涓猺ep
    # 妫€鏌99.raw鏄惁鏄垪琛?```

#### b) main() 鍑芥暟寮傚父澶勭悊
- JSON瑙ｆ瀽寮傚父鎹曡幏
- 鏁版嵁楠岃瘉寮傚父鎹曡幏
- 鏂囦欢I/O寮傚父鎹曡幏
- 瀹屾暣鐨勫爢鏍堣窡韪紙traceback锛夌敤浜庤皟璇?
**浼樺娍**:
- 鏁版嵁瀹屾暣鎬ф鏌ラ槻姝㈡棤鏁堝垎鏋?- 娓呮櫚鐨勯敊璇姤鍛?- 闃叉閮ㄥ垎缁撴灉杈撳嚭

---

## 馃搳 鏀硅繘褰卞搷鎬荤粨

| 缁村害 | 鏀硅繘鍓?| 鏀硅繘鍚?|
|------|--------|--------|
| **浠ｇ爜鍋ュ．鎬?* | 猸愨瓙猸愨瓙 | 猸愨瓙猸愨瓙猸?|
| **閿欒璇婃柇** | 涓瓑 | 浼樼 |
| **璺ㄥ钩鍙板吋瀹规€?* | 涓瓑 | 浼樼 |
| **Git浠撳簱娓呮磥搴?* | 浣?| 浼樼 |
| **鐢熶骇灏辩华搴?* | 寰堝ソ | 鐢熶骇绾?|

---

## 鈴笍 鍚庣画鍙€夋敼杩涳紙浣庝紭鍏堢骇锛?
濡傛灉鏃堕棿鍏佽锛屽彲鑰冭檻锛?
1. **鏇存柊渚濊禆鐗堟湰** (`requirements.txt`)
   - `scipy>=1.13.0` (褰撳墠1.10.0)
   - `numpy>=1.26.0` (褰撳墠1.24.0)
   - `pandas>=2.2.0` (褰撳墠2.0.0)

2. **娣诲姞Node.js鍗曞厓娴嬭瘯妗嗘灦** (`node-tap` 鎴?`jest`)
   - 涓篳algorithms.js`娣诲姞鍗曞厓娴嬭瘯
   - 涓篳metrics.js`娣诲姞缁熻鍑芥暟娴嬭瘯

3. **涓篜ython鑴氭湰娣诲姞鍛戒护琛屽府鍔?*
   ```bash
   python statistical_tests.py --help
   ```

---

## 鉁?浠ｇ爜瀹℃牳瀹屾垚

鎵€鏈夐珮浼樺厛绾ф敼杩涘凡瀹屾垚銆備唬鐮佺幇宸?*鐢熶骇绾у埆**锛屽彲浠ュ畨鍏ㄥ湴涓婁紶鍒癎itHub銆?
**涓嬩竴姝?*: 閰嶇疆GitHub浠撳簱



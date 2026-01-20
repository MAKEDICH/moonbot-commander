/**
 * Утилиты для работы с триггерами и параметрами стратегий
 */

/**
 * Парсинг диапазона номеров (например: "1-5, 10, 15-20")
 * @param {string} s - Строка с диапазонами
 * @returns {number[]} Массив чисел
 */
export const parseRangeList = (s) => {
    if (!s) return [];
    s = String(s).trim();
    if (!s) return [];
    const parts = s.split(/[ ,;]+/);
    const set = {};
    for (const p of parts) {
        if (!p) continue;
        const r = p.match(/^(\d+)\s*-\s*(\d+)$/);
        if (r) {
            let a = parseInt(r[1], 10), b = parseInt(r[2], 10);
            if (b < a) { const t = a; a = b; b = t; }
            for (let k = a; k <= b; k++) set[k] = 1;
        } else {
            const n = parseInt(p, 10);
            if (!isNaN(n)) set[n] = 1;
        }
    }
    return Object.keys(set).map(x => parseInt(x, 10)).sort((a, b) => a - b);
};

/**
 * Извлечение списка номеров из значения параметра
 * @param {string} v - Значение параметра
 * @returns {number[]} Массив номеров
 */
export const extractNumsList = (v) => {
    if (!v) return [];
    const out = [];
    const seen = {};
    String(v).split(/[\s,;]+/).forEach(tok => {
        const m = tok.match(/^(\d+)(?:\s*=\s*\d+)?$/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (!seen[n]) { seen[n] = 1; out.push(n); }
        }
    });
    return out;
};

/**
 * Извлечение одиночного номера
 * @param {string} v - Значение
 * @returns {number[]} Массив с одним номером или пустой
 */
export const extractSingle = (v) => {
    const m = (String(v) || "").match(/\d+/);
    return (m && m[0]) ? [parseInt(m[0], 10)] : [];
};

/**
 * Определение типа параметра
 * @param {string} p - Имя параметра
 * @returns {string} Тип параметра
 */
export const typeOfParam = (p) => {
    if (p === "TriggerKeysBL") return "BL";
    if (p === "SellByTriggerBL") return "Sell";
    if (p === "ClearTriggerKeys") return "Clear";
    if (["TriggerKey", "TriggerKeyBuy", "TriggerKeyProfit"].includes(p)) return "Launch";
    if (["TriggerByKey"].includes(p)) return "ByKey";
    if (["TriggerSeconds", "TriggerSecondsBL"].includes(p)) return "Seconds";
    return "Other";
};

/**
 * Преобразование значения в Map
 * @param {string} txt - Текст значения
 * @returns {Object} Map номер -> значение
 */
export const valToMap = (txt) => {
    const map = {};
    String(txt || '').trim().split(/[\s,;]+/).filter(Boolean).forEach(tok => {
        const m = tok.match(/^(\d+)(?:=(\d+))?$/);
        if (!m) return;
        const k = parseInt(m[1], 10);
        const s = m[2] ? parseInt(m[2], 10) : true;
        map[k] = s;
    });
    return map;
};

/**
 * Преобразование Map в текст
 * @param {Object} map - Map номер -> значение
 * @param {string} sep - Разделитель
 * @returns {string} Текстовое представление
 */
export const mapToText = (map, sep) => {
    const ks = Object.keys(map).map(x => parseInt(x, 10)).sort((a, b) => a - b);
    return ks.map(k => map[k] === true ? String(k) : (k + "=" + map[k])).join(sep === ' ' ? ' ' : sep);
};

/**
 * Построение команды SetParam
 * @param {string} name - Имя стратегии
 * @param {string} param - Имя параметра
 * @param {string} val - Значение
 * @returns {string} Команда SetParam
 */
export const buildSetParamCommand = (name, param, val) => {
    const safe = name ? (`"${name}"`) : '"UNDEFINED"';
    return `SetParam ${safe} ${param} ${val}`;
};

/**
 * Подсчёт количества стратегий
 * @param {Array} items - Массив элементов
 * @returns {number} Количество стратегий
 */
export const countStrategies = (items) => {
    let c = 0;
    (items || []).forEach(it => {
        if (it.type === "folder") { c += (it.strategies || []).length; }
        else { c++; }
    });
    return c;
};


class Random {
    constructor(seed) {
        if (typeof seed === "undefined") {
            this.seed = new Date().getTime()
        } else {
            this.seed = seed
        }
        this.random = this.splitmix32(this.seed);
    }
    splitmix32(a) {
        return function () {
            a |= 0;
            a = a + 0x9e3779b9 | 0;
            let t = a ^ a >>> 16;
            t = Math.imul(t, 0x21f0aaad);
            t = t ^ t >>> 15;
            t = Math.imul(t, 0x735a2d97);
            return ((t = t ^ t >>> 15) >>> 0) / 4294967296;
        }
    }
    next() {
        //return Math.random();
        return this.random();
        //const x = Math.sin(this.seed++) * 10000;
        //return x - Math.floor(x)
    }
}
class Vector {
    constructor(values, weight = 1) {
        this.values = values;
        this.weight = weight
    }
    distanceTo(p) {
        let sumSquares = 0;
        const len = this.values.length;
        for (let i = 0; i < len; i++) {
            sumSquares += (p.values[i] - this.values[i]) * (p.values[i] - this.values[i])
        }
        return Math.sqrt(sumSquares)
    }
    distance2(p) {
        let sumSquares = 0;
        const len = this.values.length;
        for (let i = 0; i < len; i++) {
            sumSquares += (p.values[i] - this.values[i]) * (p.values[i] - this.values[i])
        }
        return sumSquares
    }
    static average(pts) {
        //if (pts.length === 0) {
        //    throw Error("Can't average 0 elements")
        // }
        const dims = pts[0].values.length;
        const values = [];
        for (let i = 0; i < dims; i++) {
            values.push(0)
        }
        let weightSum = 0;
        for (const p of pts) {
            weightSum += p.weight;
            for (let i = 0; i < dims; i++) {
                values[i] += p.weight * p.values[i]
            }
        }
        for (let i = 0; i < values.length; i++) {
            values[i] /= weightSum
        }
        return new Vector(values)
    }
}
class Settings {
    constructor(bPrepass = false) {
        this.removeFacetsFromLargeToSmall = 1; // 0=small to large, 1=large to small, -1=random
        this.maximumNumberOfFacets = Number.MAX_VALUE;
        this.kMeansColorRestrictions = [];
        this.doPrepass = true;
        this.narrowPixelStripCleanupRuns = 1;
        this.epsilon = 0;
        this.bNoKMeans = false;
        this.angleEpsilon = 10;
        this.NarrowFacetCleanupEps = -1;

        if (!bPrepass) {
            this.kMeansNrOfClusters = 18;
            this.areaFactor = 50;
            this.kMeansMinDeltaDifference = 0;
            this.removeFacetsSmallerThanNrOfPoints = 100;
            this.nrOfTimesToHalveBorderSegments = 3;
            this.minBB = 0;
            this.bitsToChopOff = 2;
        }
        else {
            this.kMeansNrOfClusters = 24;
            this.areaFactor = 500000;
            this.kMeansMinDeltaDifference = 0;
            this.removeFacetsSmallerThanNrOfPoints = 20;
            this.nrOfTimesToHalveBorderSegments = 2;
            this.minBB = 0;
            this.bitsToChopOff = 2;
        }
    }
}
class KMeans {
    constructor(points, k, random, centroids = null) {
        this.points = points;
        this.k = k < points.length ? k : points.length;
        this.random = random;
        this.currentIteration = 0;
        this.pointsPerCategory = [];
        this.centroids = [];
        this.currentDeltaDistanceDifference = 0;
        if (centroids != null) {
            this.centroids = centroids;
            for (let i = 0; i < this.k; i++) {
                this.pointsPerCategory.push([])
            }
        } else {
            this.initCentroids()
        }
    }
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(this.random.next() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
    farthestPointSampling(points, n) {
        if (n > points.length) throw new Error("n cannot be greater than number of points");
        const selected = [points[0]];
        const remaining = points.slice(1);

        while (selected.length < n) {
            let maxDist = -Infinity;
            let nextIdx = -1;
            for (let i = 0; i < remaining.length; i++) {
                const p = remaining[i];
                // Find the minimum distance to any selected point using Vector.distanceTo
                let minDist = Infinity;
                for (const s of selected) {
                    const dist = p.distanceTo(s);
                    if (dist < minDist) minDist = dist;
                }
                // Find the point with the maximum of these minimum distances
                if (minDist > maxDist) {
                    maxDist = minDist;
                    nextIdx = i;
                }
            }
            selected.push(remaining[nextIdx]);
            remaining.splice(nextIdx, 1);
        }
        return selected;
    }

    initCentroids() {
        if (this.random.next() < 0.5) {
            this.centroids = [];
            const firstIdx = Math.floor(this.random.next() * this.points.length);
            this.centroids.push(this.points[firstIdx]);
            while (this.centroids.length < this.k) {
                // Compute squared distances to nearest centroid
                const distances = this.points.map(p => {
                    let minDist = Infinity;
                    for (const c of this.centroids) {
                        const dist = p.distance2(c);
                        //minDist += dist;
                        if (dist < minDist) minDist = dist;
                    }
                    return minDist;// * p.weight;// * minDist;
                });

                // Weighted random selection with best compactness
                const sum = distances.reduce((a, b) => a + b, 0);
                let midx = 0, minSum = Infinity;
                for (let t = 0; t < 1; t++) {
                    let idx = 0;
                    let r = this.random.next() * sum;
                    for (; idx < distances.length; idx++) {
                        r -= distances[idx];
                        if (r <= 0) break;
                    }
                    let distSum = 0;
                    for (let p = 0; p < this.points.length; p++) {
                        distSum += this.points[p].distance2(this.points[idx]);
                    }
                    if (distSum < minSum) {
                        minSum = distSum;
                        midx = idx;
                    }
                }

                // Avoid duplicates
                let candidate = this.points[midx];
                if (!this.centroids.includes(candidate)) {
                    this.centroids.push(candidate);
                } else {
                    // fallback: pick next not-in-centroids
                    for (let j = 0; j < this.points.length; j++) {
                        if (!this.centroids.includes(this.points[j])) {
                            this.centroids.push(this.points[j]);
                            break;
                        }
                    }
                }
            }
            for (let i = 0; i < this.k; i++) {
                this.pointsPerCategory.push([])
            }
        }
        else {
            this.shuffle(this.points);
            for (let i = 0; i < this.k; i++) {
                this.centroids.push(this.points[i]);
                this.pointsPerCategory.push([])
            }
        }
    }
    step() {
        for (let i = 0; i < this.k; i++) {
            this.pointsPerCategory[i].length = 0
        }
        for (const p of this.points) {
            let minDist = Number.MAX_VALUE;
            let centroidIndex = -1;
            for (let k = 0; k < this.k; k++) {
                const dist = this.centroids[k].distanceTo(p);
                if (dist < minDist) {
                    centroidIndex = k;
                    minDist = dist
                }
            }
            this.pointsPerCategory[centroidIndex].push(p)
        }
        let totalDistanceDiff = 0;
        for (let k = 0; k < this.pointsPerCategory.length; k++) {
            const cat = this.pointsPerCategory[k];
            if (cat.length > 0) {
                const avg = Vector.average(cat);
                const dist = this.centroids[k].distanceTo(avg);
                totalDistanceDiff += dist;
                this.centroids[k] = avg
            }
        }
        this.currentDeltaDistanceDifference = totalDistanceDiff;
        this.currentIteration++
    }
}

function cloneImageData(imageData) {
    return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function rgb2lab(rgb) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, x, y, z;
    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;
    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}
function lab2rgb(lab) {
    let y = (lab[0] + 16) / 116, x = lab[1] / 500 + y, z = y - lab[2] / 200, r, g, b;
    x = 0.95047 * ((x * x * x > 0.008856) ? x * x * x : (x - 16 / 116) / 7.787);
    y = 1.00000 * ((y * y * y > 0.008856) ? y * y * y : (y - 16 / 116) / 7.787);
    z = 1.08883 * ((z * z * z > 0.008856) ? z * z * z : (z - 16 / 116) / 7.787);
    r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    b = x * 0.0557 + y * -0.2040 + z * 1.0570;
    r = (r > 0.0031308) ? (1.055 * Math.pow(r, 1 / 2.4) - 0.055) : 12.92 * r;
    g = (g > 0.0031308) ? (1.055 * Math.pow(g, 1 / 2.4) - 0.055) : 12.92 * g;
    b = (b > 0.0031308) ? (1.055 * Math.pow(b, 1 / 2.4) - 0.055) : 12.92 * b;
    return [Math.max(0, Math.min(1, r)) * 255, Math.max(0, Math.min(1, g)) * 255, Math.max(0, Math.min(1, b)) * 255]
}

function updateKmeansOutputImageData(kmeans, pointsByColor, imgData, outputImgData) {
    console.time("updateKmeansOutputImageData");
    let odata = outputImgData.data;
    let width = imgData.width;
    let uniqueColors = new Set();
    for (let c = 0; c < kmeans.centroids.length; c++) {
        const centroid = kmeans.centroids[c];
        const lab = centroid.values;
        let rgb = lab2rgb(lab)
        rgb = rgb.map(v => Math.floor(v));

        let colorCount = 0;
        for (const v of kmeans.pointsPerCategory[c]) {
            const pointRGB = v.tag;
            const pointColor = (pointRGB[0] << 16) | (pointRGB[1] << 8) | pointRGB[2];
            colorCount += pointsByColor[pointColor].length;
            for (const pt of pointsByColor[pointColor]) {
                const ptx = pt % width;
                const pty = Math.floor(pt / width);
                let dataOffset = (pty * width + ptx) * 4;
                odata[dataOffset] = rgb[0];
                odata[dataOffset + 1] = rgb[1];
                odata[dataOffset + 2] = rgb[2];
                odata[dataOffset + 3] = 255;
            }
        }

        uniqueColors.add([(rgb[0] << 16) | (rgb[1] << 8) | rgb[2], colorCount]);
    }
    console.timeEnd("updateKmeansOutputImageData");
    return Array.from(uniqueColors).sort((a, b) => b[1] - a[1]).map(e => e[0] | (255 << 24));
}

function applyKMeansClustering(imgData, outputImgData, settings) {
    function removeNearestColors(imgData) {
        console.time("removeNearestColors");
        const threshold = settings.removeNearestColorsThreshold; // Distance threshold to consider colors as "near"
        // make lut of colors
        let colorLut = new Map();
        let idx = 0;
        let data = imgData.data;
        const width = imgData.width;
        const height = imgData.height;
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                const r = data[idx++];
                const g = data[idx++];
                const b = data[idx++];
                idx++;
                const colorKey = r << 16 | g << 8 | b;
                const entry = colorLut.get(colorKey);
                if (entry) {
                    entry.num++;
                } else {
                    colorLut.set(colorKey, { colorKey: colorKey, num: 1 });
                }
            }
        }
        const colors = Array.from(colorLut.entries())
            //.filter((a) => a[1].num > 0 && a[0] < 0xfafafa)
            .sort((a, b) => b[1].num - a[1].num).map((e) => e[0])
            .sort((a, b) => settings.random.next() - 0.5); // Shuffle colors to avoid bias

        // Compare each color with every other color
        const clen = colors.length;
        for (let i = 0; i < clen; i++) {
            const colorA = colors[i];
            if (colorA === -1)
                continue;

            const rA = (colorA >> 16) & 0xff; const gA = (colorA >> 8) & 0xff; const bA = colorA & 0xff;
            for (let j = i + 1; j < clen; j++) {
                let colorB = colors[j];
                if (colorB === -1)
                    continue;
                const rB = (colorB >> 16) & 0xff; const gB = (colorB >> 8) & 0xff; const bB = colorB & 0xff;
                const distance = (
                    (rA - rB) * (rA - rB) +
                    (gA - gB) * (gA - gB) +
                    (bA - bB) * (bA - bB)
                );
                if (distance <= threshold * threshold) {
                    // Remove colorB by setting it to colorA in the image data
                    colorLut.set(colorB, { colorKey: colorA, num: 0 });
                    colors[j] = -1;
                }
            }
        }
        // Update the image data with the reduced colors
        idx = 0;
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                const r = data[idx++];
                const g = data[idx++];
                const b = data[idx++];
                const a = data[idx++];
                const colorKey = r << 16 | g << 8 | b;
                const newColor = colorLut.get(colorKey).colorKey;
                const newR = (newColor >> 16) & 0xff; const newG = (newColor >> 8) & 0xff; const newB = newColor & 0xff;
                data[idx - 4] = newR;
                data[idx - 3] = newG;
                data[idx - 2] = newB;
                data[idx - 1] = a;
            }
        }
        console.timeEnd("removeNearestColors");
    }
    if (settings.removeNearestColorsThreshold > 0)
        removeNearestColors(imgData);

    let vectors = [];
    let idx = 0;
    let vIdx = 0;
    const bitsToChopOff = settings.bitsToChopOff;
    const pointsByColor = {};
    let data = imgData.data;
    const width = imgData.width;
    const height = imgData.height;
    for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
            let r = data[idx++];
            let g = data[idx++];
            let b = data[idx++];
            const a = data[idx++];
            /*if (a > 1000) {
                r = Math.min(255, Math.floor(r * 255 / a));
                g = Math.min(255, Math.floor(g * 255 / a));
                b = Math.min(255, Math.floor(b * 255 / a));
            }*/
            r = r >> bitsToChopOff << bitsToChopOff;
            g = g >> bitsToChopOff << bitsToChopOff;
            b = b >> bitsToChopOff << bitsToChopOff;
            const color = (r << 16) | (g << 8) | b;// `${r},${g},${b}`;
            if (!(color in pointsByColor)) {
                pointsByColor[color] = [j * width + i]
            } else {
                //for (let k = 0; k < (a == 255 ? 100 : 1); k++) {
                pointsByColor[color].push(j * width + i)
                //}
            }
        }
    }
    for (const color of Object.keys(pointsByColor)) {
        const rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
        let data = rgb2lab(rgb)
        const weight = pointsByColor[color].length / (width * height);
        const vec = new Vector(data, weight);
        vec.tag = rgb;
        vectors[vIdx++] = vec
    }

    let kmeans = new KMeans(vectors, settings.kMeansNrOfClusters, settings.random);
    //let curTime = new Date().getTime();
    kmeans.step();
    while (kmeans.currentDeltaDistanceDifference > settings.kMeansMinDeltaDifference) {
        kmeans.step();
    }
    //kmeans.reduceCentroids();

    return updateKmeansOutputImageData(kmeans, pointsByColor, imgData, outputImgData);
}

function loadOpenCV() {
    try {
        importScripts('./opencv2.js');
    } catch (err) {
        console.error("Failed to load OpenCV.js in worker:", err);
        //self.postMessage({ type: 'error', error: "Failed to load OpenCV.js: " + err.message });
        //return;
    }
    cv.onRuntimeInitialized = () => {
        console.log("OpenCV.js runtime initialized in worker.");
        //self.postMessage("OpenCV ready");
    };
}
loadOpenCV();


self.onmessage = async function (event) {
    let cv2 = await cv;
    const { type, data } = event.data;

    if (type === 'init') {
        //self.postMessage({ type: 'ready' });
    } else if (type === 'generatePalette') {
        const { imageData, batch, paletteSize = 33, rndFactor = 10, filter = true } = data;
        console.log("generatePalette called in worker with batch size:", batch, "paletteSize:", paletteSize, "rndFactor:", rndFactor);
        try {
            for (let i = 0; i < batch; i++) {
                const settings = new Settings(true);
                const random = new Random(Date.now() & 0x0fffffff);//new Date().getTime() + workerId + 0);       
                settings.kMeansNrOfClusters = Math.floor(random.next() * (paletteSize >> 2)) + (paletteSize >> 1) + (paletteSize >> 2);
                settings.bitsToChopOff = Math.floor(random.next() * 3);
                settings.kMeansMinDeltaDifference = Math.floor(random.next() * 3);
                settings.removeNearestColorsThreshold = rndFactor;
                settings.random = random;

                const imageData2 = cloneImageData(imageData);

                if (filter) {
                    console.time("pyrMeanShiftFiltering");
                    let srcNoAlpha = new cv2.Mat();
                    let src = cv2.matFromImageData(imageData2);
                    cv2.cvtColor(src, srcNoAlpha, cv2.COLOR_RGBA2RGB);
                    src.delete();
                    let dst = new cv2.Mat();

                    //cv.pyrDown(srcNoAlpha, dst);
                    cv2.pyrMeanShiftFiltering(srcNoAlpha, dst, 10, 10, 0);
                    srcNoAlpha.delete();

                    let dstRGBA = new cv2.Mat();
                    cv2.cvtColor(dst, dstRGBA, cv2.COLOR_RGB2RGBA);
                    dst.delete();
                    const pyrMeanShiftImgData = new ImageData(new Uint8ClampedArray(dstRGBA.data), dstRGBA.cols, dstRGBA.rows);
                    dstRGBA.delete();
                    imageData2.data.set(pyrMeanShiftImgData.data);
                    console.timeEnd("pyrMeanShiftFiltering");
                }

                const imageData3 = cloneImageData(imageData2);
                const uniqueColors = applyKMeansClustering(imageData2, imageData3, settings);

                self.postMessage({
                    type: 'paletteResult',
                    data: {
                        imageData: imageData3,
                        kMeansNrOfClusters: settings.kMeansNrOfClusters,
                        uniqueColors: uniqueColors
                    }
                });
            }
        } catch (error) {
            self.postMessage({
                type: 'error',
                error: error.message
            });
        }
    } else if (type === 'updateImageWithPalette') {
        let { imageData, oldColors, newColors, minFilterSize } = data;

        if (minFilterSize > 0) {
            console.time("morphology");
            let srcNoAlpha = new cv2.Mat();
            let src = cv2.matFromImageData(imageData);
            cv2.cvtColor(src, srcNoAlpha, cv2.COLOR_RGBA2RGB);
            src.delete();
            let dst = new cv2.Mat();

            const iters = [0, 1, 1, 2, 3, 4, 3, 5];
            const sizes = [0, 2, 3, 2, 2, 2, 3, 2];
            const iter = iters[Math.min(iters.length - 1, minFilterSize)];
            const size = sizes[Math.min(sizes.length - 1, minFilterSize)];

            cv2.morphologyEx(srcNoAlpha, dst, cv2.MORPH_ERODE,
                cv2.getStructuringElement(cv2.MORPH_CROSS, new cv2.Size(size, size)), new cv2.Point(-1, -1), iter);
            srcNoAlpha.delete();

            let dstRGBA = new cv2.Mat();
            cv2.cvtColor(dst, dstRGBA, cv2.COLOR_RGB2RGBA);
            dst.delete();
            const newImageData = new ImageData(new Uint8ClampedArray(dstRGBA.data), dstRGBA.cols, dstRGBA.rows);
            dstRGBA.delete();
            imageData.data.set(newImageData.data);

            // calculate unique colors after morphology
            {
                let colorLut = new Map();
                let idx = 0;
                let data = imageData.data;
                const width = imageData.width;
                const height = imageData.height;
                for (let j = 0; j < height; j++) {
                    for (let i = 0; i < width; i++) {
                        const r = data[idx++];
                        const g = data[idx++];
                        const b = data[idx++];
                        idx++;
                        const colorKey = r << 16 | g << 8 | b;
                        const entry = colorLut.get(colorKey);
                        if (entry) {
                            entry.num++;
                        } else {
                            colorLut.set(colorKey, { colorKey: colorKey, num: 1 });
                        }
                    }
                }
                oldColors = Array.from(colorLut.entries())
                    .sort((a, b) => b[1].num - a[1].num).map((e) => (e[0] | (255 << 24)));
            }

            console.timeEnd("morphology");
        }

        console.time("updateImageWithPalette");
        for (let i = 0; i < oldColors.length; i++) {
            if (newColors[i] >> 24 === 0) {
                // find nearest non-negative new color and replace
                let nearestIdx = -1;
                let nearestDist = Number.MAX_VALUE;
                const rA = (oldColors[i] >> 16) & 0xff; const gA = (oldColors[i] >> 8) & 0xff; const bA = oldColors[i] & 0xff;
                for (let j = 0; j < newColors.length; j++) {
                    if (newColors[j] >> 24 !== 0) {
                        const rgbA = [(oldColors[i] >> 16) & 255, (oldColors[i] >> 8) & 255, oldColors[i] & 255];
                        const rgbB = [(newColors[j] >> 16) & 255, (newColors[j] >> 8) & 255, newColors[j] & 255];
                        const A = rgb2lab(rgbA);
                        const B = rgb2lab(rgbB);
                        const distance = (
                            (A[0] - B[0]) * (A[0] - B[0]) +
                            (A[1] - B[1]) * (A[1] - B[1]) +
                            (A[2] - B[2]) * (A[2] - B[2])
                        );
                        if (distance < nearestDist) {
                            nearestDist = distance;
                            nearestIdx = j;
                        }
                    }
                }
                if (nearestIdx !== -1) {
                    newColors[i] = newColors[nearestIdx];
                } else {
                    newColors[i] = oldColors[i];
                }
            }
        }

        let colorMap = {};
        for (let i = 0; i < oldColors.length; i++) {
            colorMap[oldColors[i] & 0xFFFFFF] = newColors[i];
        }

        let idata = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                const idx = (j * width + i) * 4;
                const r = idata[idx];
                const g = idata[idx + 1];
                const b = idata[idx + 2];
                //const a = idata[idx + 3];
                const colorKey = (r << 16) | (g << 8) | b;
                const c = colorMap[colorKey];
                if (c !== undefined) {
                    const [newR, newG, newB] = [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
                    idata[idx] = newR;
                    idata[idx + 1] = newG;
                    idata[idx + 2] = newB;
                }
            }
        }
        console.timeEnd("updateImageWithPalette");
        self.postMessage({
            type: 'updateImageResult',
            data: {
                imageData: imageData,
            }
        });
    }

};


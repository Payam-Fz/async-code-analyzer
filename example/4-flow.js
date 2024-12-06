// No problem
async function test1() {
    let i = 0;
    let data = [];
    while (data.length < 50) {
        if (data.includes('New York')) {
            const newYorkData = await fetchInfo(data);
            data.push(newYorkData);
        }
        const otherData = await fetchOtherData(data, i);
        data.push(otherData);
        i++;
    }
}
// No problem
async function test2() {
    let i = 0;
    let data = [];
    while (data.length < 50) {
        if (data.includes('New York')) {
            const newYorkData = await fetchInfo("pizza");
            data.push(newYorkData);
        }
        const otherData = await fetchOtherData(data, i);
        data.push(otherData);
        i++;
    }
}

// Problematic because otherData does not depend on newYorkData
async function test3() {
    let i = 0;
    let data = [];
    while (data.length < 50) {
        if (data.includes('New York')) {
            const newYorkData = await fetchInfo("pizza");
            data.push(newYorkData);
        }
        const otherData = await fetchOtherData(i);
        data.push(otherData);
        i++;
    }
}

// Problematic because otherData still waits on independent data
async function test4() {
    let i = 0;
    let data = [];

    while (data.length < 50) {
        if (data.includes('New York')) {
            const newYorkData = await fetchInfo(data);
            data.push(newYorkData);
        }
        const otherData = await fetchOtherData(i);
        data.push(otherData);
        i++;
    }
}

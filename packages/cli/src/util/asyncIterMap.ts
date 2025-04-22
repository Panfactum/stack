export async function asyncIterMap<T, R>(asyncIter: AsyncIterable<T>, asyncFunc: (val: T) => Promise<R>) {
    const promises = [];
    for await (const value of asyncIter) {
        promises.push(asyncFunc(value))
    }
    return Promise.all(promises)
}
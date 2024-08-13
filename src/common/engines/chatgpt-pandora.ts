import { AbstractEngine } from '@/common/engines/abstract-engine'
import { IMessageRequest, IModel } from '@/common/engines/interfaces'
import { fetchSSE, getSettings } from '@/common/utils'

export class ChatGPTPandora extends AbstractEngine {
    getModel(): Promise<string> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return Promise.resolve('gpt-3.5-turbo')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    listModels(apiKey: string | undefined): Promise<IModel[]> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return Promise.resolve([])
    }

    async sendMessage(req: IMessageRequest): Promise<void> {
        console.log('send pandora message', req)
        const settings = await getSettings()
        const url = settings.chatGPTPandoraAPIURL
        const headers = {
            'Origin': 'https://chat18.aichatos8.com',
            'Content-Type': 'application/json',
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 Edg/91.0.864.41',
        }
        const body = {
            prompt: req.rolePrompt ? req.rolePrompt + '\n\n' + req.commandPrompt : req.commandPrompt,
            userId: '#/chat/1723517724742',
            network: true,
            system: '',
            withoutContext: false,
            stream: true,
        }
        let hasError = false
        let finished = false
        await fetchSSE(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: req.signal,
            onStatusCode: (status) => {
                req.onStatusCode?.(status)
            },
            onMessage: (msg) => {
                if (finished) return
                let resp
                try {
                    resp = JSON.parse(msg)
                    console.log('resp===>', resp)
                } catch (e) {
                    hasError = true
                    finished = true
                    req.onError(JSON.stringify(e))
                    return
                }
            },
            onError: (err) => {
                debugger
                hasError = true
                if (err instanceof Error) {
                    req.onError(err.message)
                    return
                }
                if (typeof err === 'string') {
                    req.onError(err)
                    return
                }
                if (typeof err === 'object') {
                    const item = err[0]
                    if (item && item.error && item.error.message) {
                        req.onError(item.error.message)
                        return
                    }
                }
                const { error } = err
                if (error instanceof Error) {
                    req.onError(error.message)
                    return
                }
                if (typeof error === 'object') {
                    const { message } = error
                    if (message) {
                        if (typeof message === 'string') {
                            req.onError(message)
                        } else {
                            req.onError(JSON.stringify(message))
                        }
                        return
                    }
                }
                req.onError('Unknown error')
            },
        })
    }
}

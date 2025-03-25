import { AbstractEngine } from '@/common/engines/abstract-engine'
import { IMessageRequest, IModel } from '@/common/engines/interfaces'
import { fetchSSE, getSettings } from '@/common/utils'
import { getUniversalFetch } from '@/common/universal-fetch'

export class Yuanbao extends AbstractEngine {
    async getModel(): Promise<string> {
        return ''
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async listModels(_apiKey: string | undefined): Promise<IModel[]> {
        return [
            { id: 'deep_seek_v3', name: 'deep_seek_v3' },
            { id: 'deep_seek', name: 'deep_seek' },
            { id: 'hunyuan_t1', name: 'hunyuan_t1' },
            { id: 'hunyuan_gpt_175B_0404', name: 'hunyuan_gpt_175B_0404' },
        ]
    }

    async sendMessage(req: IMessageRequest): Promise<void> {
        const settings = await getSettings()
        const conversationId = await this.createConversation()
        if (!conversationId) {
            req.onError('Fail create conversation')
        }
        const content = req.rolePrompt ? req.rolePrompt + '\n\n' + req.commandPrompt : req.commandPrompt
        const body = JSON.stringify({
            model: 'gpt_175B_0404',
            prompt: content,
            plugin: 'Adaptive',
            chatModelId: settings.yuanbaoModel,
            displayPrompt: content,
            displayPromptType: 1,
            isTemporary: true,
            options: {
                imageIntention: {
                    needIntentionModel: true,
                    backendUpdateFlag: 1,
                },
            },
            multimedia: [],
            supportHint: 1,
            agentId: 'naQivTmsDa',
            version: 'v2',
        })
        let hasError = false
        let finished = false
        let start = false
        await fetchSSE(settings.yuanbaoAPIURL + '/' + conversationId, {
            method: 'POST',
            headers: await this.getHeaders(),
            body,
            signal: req.signal,
            onMessage: async (msg: string) => {
                if (finished) return
                if (msg === 'reasoner' || msg === 'text') {
                    // skip the think start label and skip the start with text label
                    start = true
                    return
                }
                if (!start) {
                    // this flag is used to skip before the think start label
                    return
                }
                if (msg.startsWith('[plugin') || msg === '[DONE]') {
                    finished = true
                    req.onFinished('stop')
                    return
                }
                let resp
                try {
                    resp = JSON.parse(msg)
                } catch (e) {
                    hasError = true
                    finished = true
                    req.onError(JSON.stringify(e))
                    return
                }
                if (resp.type === 'think') {
                    // the think json format
                    // {"type":"think","title":"思考中...","iconType":9,"content":"好的"}
                    await req.onMessage({ content: resp.content, role: '' })
                } else if (resp.type === 'text') {
                    // the text json format
                    // {"type":"text","msg":"，"}
                    await req.onMessage({ content: resp.msg, role: '' })
                }
            },
            onError: (err) => {
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
        if (!finished && !hasError) {
            req.onFinished('stop')
        }

        return Promise.resolve(undefined)
    }

    async getHeaders() {
        const settings = await getSettings()
        return {
            'accept': 'application/json, text/plain, */*',
            'content-type': 'application/json',
            'x-source': 'web',
            'cookie': `hy_source=web;hy_user=${settings.yuanbaoHyUser};hy_token=${settings.yuanbaoHyToken}`,
            'Referer': 'https://yuanbao.tencent.com/chat/naQivTmsDa',
        }
    }

    async createConversation() {
        const settings = await getSettings()
        const fetcher = getUniversalFetch()
        const body = JSON.stringify({ agentId: 'naQivTmsDa' })
        const resp = await fetcher(settings.yuanbaoConversationAPIURL, {
            method: 'POST',
            headers: await this.getHeaders(),
            body,
        })
        if (resp.status === 200) {
            return (await resp.json()).id
        }
        return ''
    }
}

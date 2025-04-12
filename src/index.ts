/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { streamText } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';
import { z } from 'zod';

interface Env {
	AI: Ai;
	ACCESS_KEY: string;
}

const requestSchema = z.object({
	prompt: z.string({ required_error: 'Prompt required' }).min(15).max(255),
});

export default {
	async fetch(request, env, ctx): Promise<Response> {
		// checking for accesskey header
		const headers = new Headers(request.headers);
		const keyHeader = headers.get('x-access-key');
		if (keyHeader !== env.ACCESS_KEY) {
			return new Response('access denied', { status: 403 });
		}
		// parsing request
		let parsedData;
		try {
			const reqData = await request.json();
			parsedData = requestSchema.safeParse(reqData);

			if (!parsedData.success) {
				return new Response(JSON.stringify(parsedData.error), { status: 400 });
			}
		} catch (error) {
			return new Response('Request body error', { status: 400 });
		}

		// fetching AI data
		const workerAI = createWorkersAI({ binding: env.AI });
		const result = streamText({
			model: workerAI('@cf/meta/llama-2-7b-chat-int8'),
			prompt: parsedData.data.prompt,
		});

		return result.toTextStreamResponse({
			headers: {
				// add these headers to ensure that the
				// response is chunked and streamed
				'Content-Type': 'text/x-unknown',
				'content-encoding': 'identity',
				'transfer-encoding': 'chunked',
			},
		});
	},
} satisfies ExportedHandler<Env>;

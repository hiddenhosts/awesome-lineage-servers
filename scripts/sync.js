/**
 * Sync server list from HiddenHosts public API
 *
 * Environment variables:
 *   GAME_SLUG - Game slug to fetch (set in workflow)
 *   SITE_URL  - Base URL of HiddenHosts (default: https://hiddenhosts.com)
 */

const fs = require('node:fs')
const path = require('node:path')

const GAME_SLUG = process.env.GAME_SLUG
const SITE_URL = process.env.SITE_URL || 'https://hiddenhosts.com'
const API_URL = `${SITE_URL}/api/servers/list`
const DEFAULT_LOCALE = 'tw'

function localeUrl(path, locale) {
	if (locale === DEFAULT_LOCALE) return `${SITE_URL}${path}`
	return `${SITE_URL}/${locale}${path}`
}

if (!GAME_SLUG) {
	console.error('Error: GAME_SLUG environment variable is required')
	process.exit(1)
}

async function fetchServers() {
	const url = `${API_URL}?game=${GAME_SLUG}&sort=votes&limit=100`
	console.log(`Fetching servers from: ${url}`)

	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`API responded with ${response.status}: ${response.statusText}`)
	}

	const json = await response.json()
	return json.data || []
}

function formatRate(rate) {
	if (!rate || rate === '0') return '-'
	const num = Number.parseFloat(rate)
	if (num >= 1000) return `${(num / 1000).toFixed(0)}Kx`
	return `${num}x`
}

function formatRating(rating, count) {
	if (!count || count === 0) return '-'
	return `${Number.parseFloat(rating).toFixed(1)}/5`
}

function generateMarkdownTable(servers, locale) {
	const isEn = locale === 'en'
	const header = isEn
		? '| Name | EXP Rate | Gold Rate | Drop Rate | Votes | Rating | Link |'
		: '| 名稱 | 經驗倍率 | 金幣倍率 | 掉寶倍率 | 投票數 | 評分 | 連結 |'
	const divider = '|------|----------|----------|----------|--------|------|------|'

	if (servers.length === 0) {
		const noData = isEn ? 'No servers found' : '暫無伺服器資料'
		const viewAll = isEn ? 'View' : '查看'
		return `${header}\n${divider}\n| ${noData} | - | - | - | - | - | [${viewAll}](${localeUrl(`/game/${GAME_SLUG}`, locale)}) |`
	}

	const rows = servers.map((server) => {
		const name = server.name
		const expRate = formatRate(server.expRate)
		const goldRate = formatRate(server.goldRate)
		const dropRate = formatRate(server.dropRate)
		const votes = server.totalVotes || 0
		const rating = formatRating(server.avgRating, server.ratingCount)
		const linkText = isEn ? 'Details' : '詳情'
		const link = `[${linkText}](${localeUrl(`/server/${server.slug}`, locale)})`

		return `| ${name} | ${expRate} | ${goldRate} | ${dropRate} | ${votes} | ${rating} | ${link} |`
	})

	return `${header}\n${divider}\n${rows.join('\n')}`
}

function updateReadme(filePath, servers, locale) {
	if (!fs.existsSync(filePath)) {
		console.log(`Skipping ${filePath} (file not found)`)
		return
	}

	const content = fs.readFileSync(filePath, 'utf-8')
	const startMarker = '<!-- SERVERS_START -->'
	const endMarker = '<!-- SERVERS_END -->'

	const startIndex = content.indexOf(startMarker)
	const endIndex = content.indexOf(endMarker)

	if (startIndex === -1 || endIndex === -1) {
		console.error(`Error: Markers not found in ${filePath}`)
		return
	}

	const table = generateMarkdownTable(servers, locale)
	const newContent =
		content.substring(0, startIndex + startMarker.length) +
		'\n\n' +
		table +
		'\n\n' +
		content.substring(endIndex)

	fs.writeFileSync(filePath, newContent, 'utf-8')
	console.log(`Updated ${filePath} with ${servers.length} servers`)
}

async function main() {
	try {
		const servers = await fetchServers()
		console.log(`Fetched ${servers.length} servers for ${GAME_SLUG}`)

		updateReadme(path.join(process.cwd(), 'README.md'), servers, 'tw')
		updateReadme(path.join(process.cwd(), 'README_EN.md'), servers, 'en')

		console.log('Sync completed successfully')
	} catch (error) {
		console.error('Sync failed:', error.message)
		process.exit(1)
	}
}

main()

// Package cloudinary signs browser uploads and deletes assets that belong to
// notes the API removes. Only the API ever sees the Cloudinary API secret.
package cloudinary

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Client talks to the Cloudinary REST API.
type Client struct {
	cloudName string
	apiKey    string
	apiSecret string
	folder    string
	http      *http.Client
}

// New builds a Cloudinary client.
func New(cloudName, apiKey, apiSecret, folder string) *Client {
	return &Client{
		cloudName: cloudName,
		apiKey:    apiKey,
		apiSecret: apiSecret,
		folder:    folder,
		http:      &http.Client{Timeout: 20 * time.Second},
	}
}

// Signature is everything the browser needs to upload one file directly.
type Signature struct {
	Timestamp int64  `json:"timestamp"`
	Signature string `json:"signature"`
	APIKey    string `json:"apiKey"`
	CloudName string `json:"cloudName"`
	Folder    string `json:"folder"`
	UploadURL string `json:"uploadUrl"`
}

// SignUpload produces a signed upload payload scoped to a per-user folder, so
// one user can never overwrite another user's assets.
func (c *Client) SignUpload(userID string) Signature {
	folder := c.folder + "/" + userID
	timestamp := time.Now().Unix()

	params := map[string]string{
		"folder":    folder,
		"timestamp": strconv.FormatInt(timestamp, 10),
	}

	return Signature{
		Timestamp: timestamp,
		Signature: c.sign(params),
		APIKey:    c.apiKey,
		CloudName: c.cloudName,
		Folder:    folder,
		UploadURL: fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/auto/upload", c.cloudName),
	}
}

// Destroy permanently removes an asset. Failures are reported to the caller,
// which logs them: a note delete must not fail because Cloudinary is down.
func (c *Client) Destroy(ctx context.Context, publicID, resourceType string) error {
	if publicID == "" {
		return nil
	}
	if resourceType == "" {
		resourceType = "image"
	}

	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := c.sign(map[string]string{
		"public_id": publicID,
		"timestamp": timestamp,
	})

	form := url.Values{
		"public_id": {publicID},
		"timestamp": {timestamp},
		"signature": {signature},
		"api_key":   {c.apiKey},
	}
	endpoint := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/%s/destroy", c.cloudName, resourceType)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("build destroy request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	res, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("call cloudinary destroy: %w", err)
	}
	defer res.Body.Close()

	var body struct {
		Result string `json:"result"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return fmt.Errorf("decode destroy response: %w", err)
	}
	// "not found" means the asset is already gone, which is the desired state.
	if body.Result != "ok" && body.Result != "not found" {
		return fmt.Errorf("cloudinary destroy returned %q", body.Result)
	}
	return nil
}

// sign builds the SHA-1 signature Cloudinary expects: parameters sorted by key,
// joined as k=v pairs, with the API secret appended.
func (c *Client) sign(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	pairs := make([]string, 0, len(keys))
	for _, k := range keys {
		pairs = append(pairs, k+"="+params[k])
	}

	sum := sha1.Sum([]byte(strings.Join(pairs, "&") + c.apiSecret))
	return hex.EncodeToString(sum[:])
}
